use std::sync::{Arc, Mutex};
use serde::Serialize;
use tauri::Emitter;
use super::provider::LLMError;

/// A request owns its output destination. Background translations never publish
/// tokens, completion events, or errors to the meeting's global event channel.
#[derive(Clone)]
pub enum CompletionOutput {
    Meeting(tauri::AppHandle),
    Private(Arc<Mutex<CollectedText>>),
}

#[derive(Default)]
pub struct CollectedText { text: String, failed: bool }

impl From<tauri::AppHandle> for CompletionOutput {
    fn from(app: tauri::AppHandle) -> Self { Self::Meeting(app) }
}

impl CompletionOutput {
    pub fn private() -> Self { Self::Private(Arc::new(Mutex::new(CollectedText::default()))) }

    pub fn emit<T: Serialize + Clone>(&self, event: &str, payload: T) -> Result<(), LLMError> {
        match self {
            Self::Meeting(app) => app.emit(event, payload)
                .map_err(|e| LLMError::ProviderError(e.to_string())),
            Self::Private(buffer) => {
                if event == "llm_stream_token" {
                    let value = serde_json::to_value(payload)?;
                    if let Some(token) = value.get("token").and_then(|v| v.as_str()) {
                        let mut text = buffer.lock().map_err(|_| LLMError::ProviderError("Output buffer lock poisoned".into()))?;
                        if text.text.len() + token.len() > 256_000 {
                            text.failed = true;
                            return Err(LLMError::InvalidResponse("Translation output exceeded limit".into()));
                        }
                        text.text.push_str(token);
                    }
                }
                Ok(())
            }
        }
    }

    pub fn text(&self) -> Result<String, LLMError> {
        match self {
            Self::Private(buffer) => {
                let buffer = buffer.lock().map_err(|_| LLMError::ProviderError("Output buffer lock poisoned".into()))?;
                if buffer.failed { return Err(LLMError::InvalidResponse("Translation output exceeded limit".into())); }
                let text = buffer.text.trim().to_string();
                if text.is_empty() { return Err(LLMError::InvalidResponse("LLM returned empty translation".into())); }
                Ok(text)
            }
            Self::Meeting(_) => Err(LLMError::InvalidResponse("Meeting output is not a text collector".into())),
        }
    }
}

// Shared across windows, bounded independently of the meeting reply. Dropping a
// timed-out future releases its permit and response stream without listeners.
static BACKGROUND_SLOTS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);

pub async fn collect_text(
    provider: Arc<dyn super::provider::LLMProvider>,
    model: &str,
    messages: Vec<super::provider::LLMMessage>,
) -> Result<String, String> {
    if model.trim().is_empty() { return Err("尚未选择回答模型，请到大语言模型设置中加载并选择模型".into()); }
    tokio::time::timeout(std::time::Duration::from_secs(25), async {
        let _permit = BACKGROUND_SLOTS.acquire().await.map_err(|e| e.to_string())?;
        let output = CompletionOutput::private();
        provider.stream_completion(messages, model, super::provider::GenerationParams::default(), output.clone())
            .await.map_err(|e| format!("LLM translation failed: {}", e))?;
        output.text().map_err(|e| e.to_string())
    }).await.map_err(|_| "Translation timed out after 25 seconds".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn concurrent_outputs_are_isolated_and_ignore_lifecycle_events() {
        let first = CompletionOutput::private();
        let second = CompletionOutput::private();
        let copy = first.clone();
        first.emit("llm_stream_token", json!({"token":"你好"})).unwrap();
        second.emit("llm_stream_token", json!({"token":"另一个翻译"})).unwrap();
        copy.emit("llm_stream_token", json!({"token":"。"})).unwrap();
        first.emit("llm_stream_end", json!({"token":"not text"})).unwrap();
        first.emit("llm_stream_error", "not text").unwrap();
        assert_eq!(first.text().unwrap(), "你好。");
        assert_eq!(second.text().unwrap(), "另一个翻译");
    }

    #[test]
    fn empty_output_is_a_failure() {
        assert!(CompletionOutput::private().text().is_err());
    }

    #[test]
    fn overflow_cannot_silently_return_a_truncated_translation() {
        let output = CompletionOutput::private();
        output.emit("llm_stream_token", json!({"token":"start"})).unwrap();
        assert!(output.emit("llm_stream_token", json!({"token":"x".repeat(256_000)})).is_err());
        assert!(output.text().is_err());
    }

    struct EchoProvider;
    #[async_trait::async_trait]
    impl super::super::provider::LLMProvider for EchoProvider {
        fn provider_name(&self) -> &str { "synthetic" }
        async fn list_models(&self) -> Result<Vec<super::super::provider::ModelInfo>, LLMError> { Ok(vec![]) }
        async fn test_connection(&self) -> Result<bool, LLMError> { Ok(true) }
        async fn stream_completion(&self, messages: Vec<super::super::provider::LLMMessage>, _model: &str, _params: super::super::provider::GenerationParams, output: CompletionOutput) -> Result<super::super::provider::CompletionStats, LLMError> {
            for c in messages[0].content.chars() {
                output.emit("llm_stream_token", json!({"token":c.to_string()}))?;
                tokio::task::yield_now().await;
            }
            Ok(super::super::provider::CompletionStats { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, latency_ms: 0 })
        }
    }
    #[tokio::test]
    async fn overlapping_background_requests_return_only_their_own_tokens() {
        use super::super::provider::LLMMessage;
        let provider: Arc<dyn super::super::provider::LLMProvider> = Arc::new(EchoProvider);
        let one = collect_text(provider.clone(), "test", vec![LLMMessage { role: "user".into(), content: "问题中文翻译".into() }]);
        let two = collect_text(provider, "test", vec![LLMMessage { role: "user".into(), content: "推荐回复中文翻译".into() }]);
        let (a, b) = tokio::join!(one, two);
        assert_eq!(a.unwrap(), "问题中文翻译"); assert_eq!(b.unwrap(), "推荐回复中文翻译");
    }
}
