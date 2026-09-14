//! Ordered, bounded Whisper REST transcription. This is short-batch STT, not
//! the Realtime API. Quiet tails are flushed without waiting for more audio.
use async_trait::async_trait;
use serde::Deserialize;
use futures::StreamExt;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use std::time::{Duration, Instant};
use tokio::{sync::mpsc, task::JoinHandle};
use crate::audio::AudioChunk;
use crate::stt::provider::{STTProvider, STTProviderType, TranscriptResult};
use super::speech_turn::{SpeechTurns, SpeechBatch, meaningful, append_overlap};

const SAMPLE_RATE: u32 = 16_000;
#[derive(Default, Deserialize)]
struct WhisperResponse {
    #[serde(default)]
    segments: Vec<WhisperSegment>,
}

#[derive(Deserialize)]
struct WhisperSegment {
    text: String,
    no_speech_prob: f64,
    avg_logprob: f64,
    compression_ratio: f64,
}

impl WhisperResponse {
    fn accepted_text(&self) -> String {
        self.segments.iter().filter(|s| {
            meaningful(&s.text) && s.no_speech_prob.is_finite() && s.avg_logprob.is_finite()
                && s.no_speech_prob < 0.85 && !(s.no_speech_prob >= 0.6 && s.avg_logprob < -0.5)
                && s.avg_logprob >= -1.2 && s.compression_ratio <= 2.4
        }).map(|s| s.text.trim()).collect::<Vec<_>>().join(" ")
    }
}

pub struct WhisperApiSTT {
    api_key: String,
    language: String,
    buffer: Arc<Mutex<SpeechTurns>>,
    tasks: Vec<JoinHandle<()>>,
    started: Option<Instant>,
    app_handle: Option<tauri::AppHandle>,
    party: String,
    overflowed: Arc<AtomicBool>,
}

impl WhisperApiSTT {
    pub fn new() -> Self {
        Self { api_key: String::new(), language: "en".into(), buffer: Arc::new(Mutex::new(SpeechTurns::default())), tasks: Vec::new(), started: None, app_handle: None, party: "You".into(), overflowed: Arc::new(AtomicBool::new(false)) }
    }
    pub fn with_api_key(api_key: &str) -> Self { let mut provider = Self::new(); provider.set_api_key(api_key); provider }
    pub fn set_api_key(&mut self, api_key: &str) { self.api_key = api_key.into(); }
    pub fn set_app_handle(&mut self, app: tauri::AppHandle) { self.app_handle = Some(app); }
    pub fn set_party(&mut self, party: &str) { self.party = party.into(); }

    fn status(app: &Option<tauri::AppHandle>, party: &str, status: &str, message: &str) {
        if let Some(app) = app {
            let _ = tauri::Emitter::emit(app, "stt_connection_status", serde_json::json!({
                "provider": "whisper_api", "party": party, "status": status, "message": message
            }));
        }
    }

    fn encode_wav(samples: &[i16]) -> Vec<u8> {
        let data_len = (samples.len() * 2) as u32;
        let mut buf = Vec::with_capacity(44 + data_len as usize);
        buf.extend_from_slice(b"RIFF");
        buf.extend_from_slice(&(36 + data_len).to_le_bytes());
        buf.extend_from_slice(b"WAVEfmt ");
        buf.extend_from_slice(&16u32.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes());
        buf.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
        buf.extend_from_slice(&(SAMPLE_RATE * 2).to_le_bytes());
        buf.extend_from_slice(&2u16.to_le_bytes());
        buf.extend_from_slice(&16u16.to_le_bytes());
        buf.extend_from_slice(b"data");
        buf.extend_from_slice(&data_len.to_le_bytes());
        for sample in samples { buf.extend_from_slice(&sample.to_le_bytes()); }
        buf
    }

    async fn transcribe(client: &reqwest::Client, key: &str, language: &str, wav: Vec<u8>) -> Result<String, String> {
        let part = reqwest::multipart::Part::bytes(wav).file_name("audio.wav").mime_str("audio/wav").map_err(|e| e.to_string())?;
        let mut form = reqwest::multipart::Form::new().text("model", "whisper-1")
            .text("response_format", "verbose_json").text("timestamp_granularities[]", "segment").part("file", part);
        if !language.is_empty() { form = form.text("language", language.split('-').next().unwrap_or(language).to_string()); }
        let response = client.post("https://api.openai.com/v1/audio/transcriptions")
            .bearer_auth(key).timeout(Duration::from_secs(20)).multipart(form).send().await
            .map_err(|e| if e.is_timeout() { "语音识别请求超时（20 秒），请检查网络".to_string() } else { "无法连接 OpenAI 语音服务，请检查网络或代理".to_string() })?;
        let status = response.status();
        if !status.is_success() {
            let hint = match status.as_u16() { 401 | 403 => "请检查语音 API Key 和模型权限", 429 => "额度不足或请求过于频繁", _ => "服务暂时不可用，请稍后重试" };
            return Err(format!("OpenAI 语音识别失败（HTTP {}）：{}", status.as_u16(), hint));
        }
        let result: WhisperResponse = response.json().await.map_err(|_| "语音服务返回格式错误或响应超时".to_string())?;
        Ok(result.accepted_text())
    }

    fn cancel(&mut self) {
        for task in self.tasks.drain(..) { task.abort(); }
        self.started = None;
        self.overflowed.store(false, Ordering::Relaxed);
        if let Ok(mut buffer) = self.buffer.lock() { *buffer = SpeechTurns::default(); }
    }
}

impl Drop for WhisperApiSTT { fn drop(&mut self) { self.cancel(); } }

#[async_trait]
impl STTProvider for WhisperApiSTT {
    fn provider_name(&self) -> &str { "Whisper API" }
    fn provider_type(&self) -> STTProviderType { STTProviderType::WhisperApi }

    async fn start_stream(&mut self, result_tx: mpsc::Sender<TranscriptResult>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.started.is_some() { return Err("Stream already active".into()); }
        if self.api_key.trim().is_empty() { return Err("尚未配置 OpenAI 语音 API Key".into()); }
        self.cancel();
        let started = Instant::now();
        self.started = Some(started);
        // Two in-flight requests per party, consumed in audio order. Backpressure
        // retains queued audio instead of silently dropping every slow batch.
        let (batch_tx, batch_rx) = mpsc::channel::<SpeechBatch>(8);
        let buffer = self.buffer.clone();
        let pause_threshold = self.app_handle.as_ref().map(|app| app.state::<crate::state::AppState>().pause_threshold_ms.clone());
        self.tasks.push(tokio::spawn(async move {
            let mut timer = tokio::time::interval(Duration::from_millis(100));
            loop {
                timer.tick().await;
                let batch = buffer.lock().ok().and_then(|mut b| {
                    if let Some(ref threshold) = pause_threshold { b.set_pause_ms(threshold.load(Ordering::Relaxed)); }
                    b.take_due(started.elapsed().as_millis() as u64)
                });
                if let Some(batch) = batch {
                    if batch_tx.send(batch).await.is_err() { break; }
                }
            }
        }));
        let api_key = self.api_key.clone();
        let language = self.language.clone();
        let app = self.app_handle.clone();
        let party = self.party.clone();
        let overflowed = self.overflowed.clone();
        self.tasks.push(tokio::spawn(async move {
            let client = reqwest::Client::new();
            let jobs = futures::stream::unfold(batch_rx, |mut rx| async move { rx.recv().await.map(|batch| (batch, rx)) }).boxed();
            let request_language = language.clone();
            let mut requests = jobs.map(move |batch| {
                let client = client.clone(); let key = api_key.clone(); let language = request_language.clone();
                Box::pin(async move {
                    let result = if batch.samples.is_empty() { Ok(String::new()) }
                        else { Self::transcribe(&client, &key, &language, Self::encode_wav(&batch.samples)).await };
                    (batch, result)
                }) as std::pin::Pin<Box<dyn std::future::Future<Output = (SpeechBatch, Result<String, String>)> + Send>>
            }).buffered(2).boxed();
            let mut turn = 0;
            let mut turn_text = String::new();
            let mut incomplete = false;
            while let Some((batch, response)) = requests.next().await {
                if turn != batch.turn { turn = batch.turn; turn_text.clear(); incomplete = false; }
                match response {
                    Ok(text) => {
                        if overflowed.load(Ordering::Relaxed) || (!batch.samples.is_empty() && !meaningful(&text)) { incomplete = true; }
                        if !incomplete { Self::status(&app, &party, "connected", "语音识别服务已响应"); }
                        append_overlap(&mut turn_text, &text, batch.overlap);
                        if meaningful(&turn_text) {
                            let result = TranscriptResult { text: turn_text.clone(), is_final: batch.is_final && !incomplete,
                                confidence: 0.0, timestamp_ms: batch.timestamp_ms, speaker: None,
                                language: Some(language.clone()), segment_id: Some(format!("speech_turn_{}", turn)) };
                            if result_tx.send(result).await.is_err() { break; }
                        }
                    }
                    Err(error) => {
                        incomplete = true;
                        log::warn!("Whisper API: {}", error);
                        Self::status(&app, &party, "error", &format!("{}；本轮转写不完整，暂停本轮自动回复", error));
                    }
                }
            }
        }));
        Ok(())
    }

    async fn feed_audio(&mut self, chunk: AudioChunk) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(started) = self.started {
            let accepted = self.buffer.lock().map_err(|_| "Audio buffer lock poisoned")?.push(&chunk.pcm_data, chunk.timestamp_ms, started.elapsed().as_millis() as u64);
            if !accepted {
                self.overflowed.store(true, Ordering::Relaxed);
                Self::status(&self.app_handle, &self.party, "error", "语音积压超过缓冲上限，已停止自动提交完整话轮；请检查网络后重新开始会议");
            }
        }
        Ok(())
    }

    async fn stop_stream(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Stop means no new upload. Await cancellation so no late transcript can
        // leak into a later meeting. Already-sent server work cannot be recalled.
        let tasks = std::mem::take(&mut self.tasks);
        for task in &tasks { task.abort(); }
        for task in tasks { let _ = task.await; }
        self.cancel();
        Ok(())
    }

    async fn test_connection(&self) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        if self.api_key.trim().is_empty() { return Err("尚未配置语音 API Key".into()); }
        // Fixed synthetic fixture only. This test never opens a microphone.
        let text = Self::transcribe(&reqwest::Client::new(), &self.api_key, "en", include_bytes!("../../fixtures/stt-probe.wav").to_vec()).await?;
        let lower = text.to_lowercase();
        if ["hello", "speech", "recognition", "test"].iter().filter(|word| lower.contains(**word)).count() < 2 {
            return Err("服务已响应，但固定语音样本未被正确识别，请重试".into());
        }
        Ok(true)
    }
    fn set_language(&mut self, language: &str) { self.language = language.into(); }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    #[ignore = "Explicit opt-in only: sends fixed synthetic speech using the saved OpenAI speech key"]
    async fn live_service_whisper_fixed_fixture() {
        let key = crate::credentials::CredentialManager::new().get_key("whisper_api").unwrap().expect("Configure the speech key in NexQ first");
        let provider = WhisperApiSTT::with_api_key(&key);
        let started = Instant::now();
        assert!(provider.test_connection().await.unwrap());
        println!("LIVE_STT_FIXED_FIXTURE_OK elapsed_ms={}", started.elapsed().as_millis());
    }
    #[test]
    fn filters_punctuation_low_confidence_and_no_speech_without_blacklisting_thanks() {
        let response: WhisperResponse = serde_json::from_value(serde_json::json!({"segments": [
            {"text":"..", "no_speech_prob":0.1,"avg_logprob":-0.1,"compression_ratio":1.0},
            {"text":"Thank you.", "no_speech_prob":0.99,"avg_logprob":-0.9,"compression_ratio":1.0},
            {"text":"invented phrase", "no_speech_prob":0.1,"avg_logprob":-2.0,"compression_ratio":1.0},
            {"text":"Thank you.", "no_speech_prob":0.02,"avg_logprob":-0.1,"compression_ratio":1.0}
        ]})).unwrap();
        assert_eq!(response.accepted_text(), "Thank you.");
    }
    #[test]
    fn wav_header_matches_pcm() {
        let wav = WhisperApiSTT::encode_wav(&[1, -2]);
        assert_eq!(wav.len(), 48); assert_eq!(&wav[..4], b"RIFF");
        assert_eq!(&wav[44..], &[1, 0, 254, 255]);
    }
    #[tokio::test]
    async fn stop_cancels_both_workers_and_discards_tail() {
        let (tx, mut rx) = mpsc::channel(8);
        let mut provider = WhisperApiSTT::with_api_key("synthetic-key-never-sent");
        provider.start_stream(tx).await.unwrap();
        provider.buffer.lock().unwrap().push(&[100; 100], 0, 0);
        provider.stop_stream().await.unwrap();
        assert!(provider.tasks.is_empty()); assert!(provider.started.is_none());
        assert!(provider.buffer.lock().unwrap().take_due(5000).is_none());
        assert!(rx.recv().await.is_none());
    }
}
