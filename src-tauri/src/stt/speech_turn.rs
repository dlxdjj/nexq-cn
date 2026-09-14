//! Audio-time turn boundaries, independent of HTTP response arrival times.
//! Local adaptive energy gate + server no-speech evidence (not speaker recognition).
use std::collections::VecDeque;

pub const RATE: usize = 16_000;
const FRAME: usize = 320; // 20 ms
const PRE_ROLL: usize = RATE * 3 / 10;
const BATCH: usize = RATE * 4;
const OVERLAP: usize = RATE / 4;
pub const QUIET_MS: u64 = 1200;

#[derive(Debug)]
pub struct SpeechBatch {
    pub samples: Vec<i16>,
    pub turn: u64,
    pub timestamp_ms: u64,
    pub is_final: bool,
    pub overlap: bool,
}

pub struct SpeechTurns {
    frames: VecDeque<i16>,
    frame_start_ms: u64,
    pre_roll: VecDeque<i16>,
    samples: Vec<i16>,
    ready: VecDeque<SpeechBatch>,
    active: bool,
    turn: u64,
    start_ms: u64,
    last_voice_ms: u64,
    voiced_frames: usize,
    noise: f64,
    overlap: bool,
    new_voice: bool,
    quiet_ms: u64,
}

impl Default for SpeechTurns {
    fn default() -> Self {
        Self { frames: VecDeque::new(), frame_start_ms: 0, pre_roll: VecDeque::new(),
            samples: Vec::new(), ready: VecDeque::new(), active: false, turn: 0,
            start_ms: 0, last_voice_ms: 0, voiced_frames: 0, noise: 12.0,
            overlap: false, new_voice: false, quiet_ms: QUIET_MS }
    }
}

impl SpeechTurns {
    pub fn set_pause_ms(&mut self, ms: u64) { self.quiet_ms = ms.clamp(500, 10_000); }
    pub fn push(&mut self, pcm: &[i16], timestamp_ms: u64, now_ms: u64) -> bool {
        // Bounded backlog; never silently claim completeness after overflow.
        if self.ready.len() >= 16 { return false; }
        if self.frames.is_empty() { self.frame_start_ms = timestamp_ms; }
        self.frames.extend(pcm);
        while self.frames.len() >= FRAME {
            let frame: Vec<i16> = self.frames.drain(..FRAME).collect();
            let remaining_ms = self.frames.len() as u64 * 1000 / RATE as u64;
            let frame_now = now_ms.saturating_sub(remaining_ms);
            let mean = frame.iter().map(|&s| s as f64).sum::<f64>() / FRAME as f64;
            let rms = (frame.iter().map(|&s| (s as f64 - mean).powi(2)).sum::<f64>() / FRAME as f64).sqrt();
            // Reject digital noise and DC offset. Learn quiet noise only, so speech
            // cannot progressively raise its own threshold and disappear.
            let threshold = (self.noise * 3.5).clamp(80.0, 600.0);
            let voice = rms >= threshold;
            if !voice { self.noise = self.noise * 0.98 + rms * 0.02; }
            self.pre_roll.extend(frame.iter().copied());
            while self.pre_roll.len() > PRE_ROLL { self.pre_roll.pop_front(); }
            self.voiced_frames = if voice { self.voiced_frames + 1 } else { 0 };
            if !self.active && self.voiced_frames >= 6 {
                self.active = true;
                self.turn += 1;
                self.start_ms = self.frame_start_ms.saturating_sub((self.pre_roll.len() - FRAME) as u64 * 1000 / RATE as u64);
                self.samples = self.pre_roll.iter().copied().collect();
                self.overlap = false;
                self.new_voice = true;
            } else if self.active {
                self.samples.extend_from_slice(&frame);
            }
            if self.active && voice { self.last_voice_ms = frame_now; self.new_voice = true; }
            if self.active && frame_now.saturating_sub(self.last_voice_ms) >= self.quiet_ms {
                self.finish();
            } else if self.active && self.samples.len() >= BATCH {
                self.emit(false);
            }
            self.frame_start_ms += 20;
        }
        true
    }

    fn emit(&mut self, is_final: bool) {
        let tail = if !is_final { self.samples[self.samples.len().saturating_sub(OVERLAP)..].to_vec() } else { Vec::new() };
        // A boundary exactly after a batch still needs a final event, not a new
        // request containing only overlap/silence (which can hallucinate).
        let samples = if self.new_voice { std::mem::take(&mut self.samples) } else { self.samples.clear(); Vec::new() };
        self.ready.push_back(SpeechBatch { samples, turn: self.turn, timestamp_ms: self.start_ms, is_final, overlap: self.overlap });
        self.samples = tail;
        self.overlap = !is_final;
        self.new_voice = false;
    }

    fn finish(&mut self) {
        self.emit(true);
        self.active = false;
        self.voiced_frames = 0;
    }

    pub fn take_due(&mut self, now_ms: u64) -> Option<SpeechBatch> {
        // WASAPI can stop delivering chunks during silence; a timer must close
        // the already-started turn without inventing/uploading silent audio.
        if self.active && now_ms.saturating_sub(self.last_voice_ms) >= self.quiet_ms { self.finish(); }
        self.ready.pop_front()
    }
}

pub fn meaningful(text: &str) -> bool { text.chars().any(char::is_alphanumeric) }

pub fn append_overlap(existing: &mut String, incoming: &str, overlap: bool) {
    if !meaningful(incoming) { return; }
    let words: Vec<&str> = incoming.split_whitespace().collect();
    let previous: Vec<&str> = existing.split_whitespace().collect();
    let normalize = |s: &str| s.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
    let duplicate = if overlap {
        (2..=8.min(words.len()).min(previous.len())).rev().find(|&n| {
            previous[previous.len()-n..].iter().zip(&words[..n]).all(|(a,b)| normalize(a) == normalize(b))
        }).unwrap_or(0)
    } else { 0 };
    let addition = words[duplicate..].join(" ");
    if !addition.is_empty() {
        if !existing.is_empty() { existing.push(' '); }
        existing.push_str(&addition);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn wave(amplitude: f64) -> Vec<i16> {
        (0..FRAME).map(|n| ((n as f64 * 0.13).sin() * amplitude) as i16).collect()
    }
    #[test]
    fn two_minutes_silence_noise_and_dc_produce_no_batches() {
        for noise in [vec![0; FRAME], vec![800; FRAME], wave(30.0)] {
            let mut turns = SpeechTurns::default();
            for n in 0..6000 { assert!(turns.push(&noise, n*20, n*20)); assert!(turns.take_due(n*20).is_none()); }
            assert!(turns.take_due(130000).is_none());
        }
    }
    #[test]
    fn clicks_do_not_open_turn() {
        let mut turns = SpeechTurns::default();
        for n in 0..100 { turns.push(&if n == 10 { wave(9000.0) } else { vec![0; FRAME] }, n*20, n*20); }
        assert!(turns.take_due(4000).is_none());
    }
    #[test]
    fn configured_pause_is_respected_without_changing_upload_boundaries() {
        let mut turns = SpeechTurns::default();
        turns.set_pause_ms(3000);
        for n in 0..50 { turns.push(&wave(700.0), n*20, n*20); }
        assert!(turns.take_due(2500).is_none());
        assert!(turns.take_due(4000).unwrap().is_final);
    }
    #[test]
    fn thirty_seconds_speech_has_one_identity_and_no_premature_final() {
        let mut turns = SpeechTurns::default();
        let mut captured = 0;
        for n in 0..1500 {
            turns.push(&wave(800.0), 1000+n*20, n*20);
            while let Some(batch) = turns.take_due(n*20) {
                assert_eq!(batch.turn, 1); assert!(!batch.is_final);
                captured += batch.samples.len() - if batch.overlap { OVERLAP } else { 0 };
            }
        }
        let last = turns.take_due(32000).unwrap();
        assert!(last.is_final); assert_eq!(last.turn, 1);
        captured += last.samples.len() - if last.overlap { OVERLAP } else { 0 };
        assert_eq!(captured, RATE * 30);
        assert!(turns.take_due(33000).is_none());
    }
    #[test]
    fn short_pause_keeps_turn_long_pause_starts_new_one() {
        let mut turns = SpeechTurns::default();
        for n in 0..180 {
            let frame = if (40..75).contains(&n) { vec![0; FRAME] } else { wave(700.0) };
            turns.push(&frame, n*20, n*20);
        }
        let first = turns.take_due(5000).unwrap();
        assert!(first.is_final); assert_eq!(first.turn, 1);
        for n in 250..280 { turns.push(&wave(700.0), n*20, n*20); }
        let second = turns.take_due(7000).unwrap();
        assert_eq!(second.turn, 2); assert!(second.is_final);
    }
    #[test]
    fn legitimate_thanks_survives_and_only_overlap_is_deduplicated() {
        let mut text = String::new();
        append_overlap(&mut text, "..", false); assert!(text.is_empty());
        append_overlap(&mut text, "Thank you.", false); assert_eq!(text, "Thank you.");
        append_overlap(&mut text, "Thank you. Could you explain why?", true);
        assert_eq!(text, "Thank you. Could you explain why?");
        append_overlap(&mut text, "why?", false); assert!(text.ends_with("why? why?"));
    }
}
