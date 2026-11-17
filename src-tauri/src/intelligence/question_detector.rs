// Sub-PRD 6: Question detection
// Layer 1: Regex (sentences ending ?, interrogative words)
// Layer 2: Interview-specific contextual patterns

use serde::{Deserialize, Serialize};

/// A detected question from the transcript.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedQuestion {
    pub text: String,
    pub confidence: f64,
    pub timestamp_ms: u64,
    pub source: String,
}

/// Detects questions in transcript text using two layers:
/// - Layer 1: Regex patterns (question marks, interrogative words)
/// - Layer 2: Interview-specific contextual patterns
pub struct QuestionDetector;

/// Interrogative words that commonly start questions.
const INTERROGATIVE_STARTERS: &[&str] = &[
    "what", "why", "how", "when", "where", "who", "which",
    "can", "could", "would", "should",
    "do", "does", "is", "are", "will", "have", "has",
    "tell",
];

/// Interview-specific patterns that indicate a question or prompt.
const INTERVIEW_PATTERNS: &[&str] = &[
    "walk me through",
    "describe a time",
    "tell me about",
    "what would you do",
    "how do you handle",
    "give me an example",
    "explain how",
    "what's your experience with",
    "what is your experience with",
    "can you walk me through",
    "can you describe",
    "can you explain",
    "can you tell me",
    "talk about a time",
    "share an example",
    "how would you",
    "how have you",
    "what approach would you",
    "what's your approach to",
    "what is your approach to",
];

/// Request forms used when the transcription has no question mark.
const INTERVIEW_REQUEST_STARTERS: &[&str] = &[
    "tell me", "tell us", "explain", "describe", "introduce yourself",
    "walk me through", "walk us through", "take me through", "take us through",
    "give me an example", "give us an example", "give an example",
    "give me one example", "give us one example", "give one example",
    "share an example", "share one example", "share a story",
    "share your experience", "share your approach", "share your perspective",
    "talk about a time", "talk to me about a time", "talk to us about a time",
    "elaborate on",
];

fn has_interview_request_start(text: &str) -> bool {
    let normalized = text
        .replace(['‘', '’'], "'")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let request = ["all right", "okay", "now", "next", "so"]
        .iter()
        .find_map(|prefix| {
            normalized
                .strip_prefix(*prefix)
                .filter(|tail| tail.starts_with([' ', ',', ':']))
                .map(|tail| tail.trim_start_matches([' ', ',', ':']))
        })
        .unwrap_or(&normalized);
    let request = [
        "i'd like you to ",
        "i would like you to ",
        "we'd like you to ",
        "we would like you to ",
    ]
    .iter()
    .find_map(|prefix| request.strip_prefix(*prefix))
    .unwrap_or(request);
    let request = request.strip_prefix("please ").unwrap_or(request);
    let request = request
        .strip_prefix("briefly ")
        .or_else(|| request.strip_prefix("quickly "))
        .unwrap_or(request);
    INTERVIEW_REQUEST_STARTERS.iter().any(|starter| {
        request.strip_prefix(*starter).is_some_and(|tail| {
            tail.is_empty() || tail.starts_with(|ch: char| !ch.is_alphanumeric() && ch != '_')
        })
    })
}

impl QuestionDetector {
    pub fn new() -> Self {
        Self
    }

    /// Detect questions in the given text.
    /// Returns a list of detected questions with confidence scores.
    pub fn detect_questions(&self, text: &str, timestamp_ms: u64, source: &str) -> Vec<DetectedQuestion> {
        let mut questions: Vec<DetectedQuestion> = Vec::new();

        // Split text into sentences
        let sentences = split_sentences(text);

        for sentence in &sentences {
            let trimmed = sentence.trim();
            if trimmed.is_empty() || trimmed.len() < 5 {
                continue;
            }

            let mut confidence: f64 = 0.0;

            // Layer 1: Check for question mark
            if trimmed.ends_with(['?', '？']) {
                confidence = 0.95;
            }

            // Layer 1: Check for interrogative word starters
            if confidence < 0.5 {
                let lower = trimmed.to_lowercase();
                let first_word = lower.split_whitespace().next().unwrap_or("");
                if INTERROGATIVE_STARTERS.contains(&first_word) {
                    // Interrogative word at start without question mark
                    confidence = confidence.max(0.6);
                }
            }

            // Layer 2: Check for interview-specific patterns
            let lower = trimmed.to_lowercase();
            if has_interview_request_start(&lower)
                || INTERVIEW_PATTERNS.iter().any(|pattern| lower.contains(*pattern))
            {
                confidence = confidence.max(0.85);
            }

            // Only include if confidence is above threshold
            if confidence >= 0.5 {
                questions.push(DetectedQuestion {
                    text: trimmed.to_string(),
                    confidence,
                    timestamp_ms,
                    source: source.to_string(),
                });
            }
        }

        questions
    }
}

/// Split text into sentences using common sentence terminators.
fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        current.push(ch);
        if matches!(ch, '.' | '?' | '!' | '。' | '？' | '！' | '\n') {
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() {
                sentences.push(trimmed);
            }
            current.clear();
        }
    }

    // Don't forget the last sentence fragment (may not end with punctuation)
    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        sentences.push(trimmed);
    }

    sentences
}

#[cfg(test)]
mod tests {
    use super::QuestionDetector;

    #[test]
    fn detects_interview_requests_for_fallback_assist() {
        let detector = QuestionDetector::new();
        for text in [
            "Give me an example of a time you led a team.",
            "I’d like you to briefly describe a difficult project.",
            "Thanks for the introduction. Next, share your approach.",
            "Okay, take me through your decision.",
        ] {
            assert_eq!(detector.detect_questions(text, 0, "Them").len(), 1, "{text}");
        }
        for text in [
            "I'd like to describe our team before we begin.",
            "I would like you to pause while I pull up your résumé.",
            "Thanks for your time. The next step is a call with our team.",
        ] {
            assert!(
                detector.detect_questions(text, 0, "Them").is_empty(),
                "{text}"
            );
        }
    }
}
