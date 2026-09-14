// Sub-PRD 6: System prompts for all 6 intelligence modes
// Assist, What to Say, Shorten, Follow-up, Recap, Ask Question

/// Returns the system prompt for a given intelligence mode.
pub fn get_system_prompt(mode: &str) -> &'static str {
    match mode {
        "Assist" => ASSIST_PROMPT,
        "WhatToSay" => WHAT_TO_SAY_PROMPT,
        "Shorten" => SHORTEN_PROMPT,
        "FollowUp" => FOLLOW_UP_PROMPT,
        "Recap" => RECAP_PROMPT,
        "AskQuestion" => ASK_QUESTION_PROMPT,
        "MeetingSummary" => MEETING_SUMMARY_PROMPT,
        "ActionItemsExtraction" => ACTION_ITEMS_EXTRACTION_PROMPT,
        "BookmarkSuggestions" => BOOKMARK_SUGGESTIONS_PROMPT,
        _ => ASSIST_PROMPT,
    }
}

pub const ASSIST_PROMPT: &str = include_str!("../../../src/lib/spokenReplyPrompt.txt");

pub const WHAT_TO_SAY_PROMPT: &str = ASSIST_PROMPT;

#[cfg(test)]
mod spoken_tests {
    #[tokio::test]
    #[ignore = "Explicit opt-in only: 3 synthetic questions, saved OpenAI key, no meeting data"]
    async fn live_service_spoken_answers() {
        use crate::llm::{openai_compat::{OpenAICompatClient, OpenAICompatConfig},
            output::CompletionOutput, provider::{LLMProvider, LLMMessage, GenerationParams}};
        let key = crate::credentials::CredentialManager::new().get_key("openai").unwrap().expect("Configure OpenAI in NexQ first");
        let client = OpenAICompatClient::new(OpenAICompatConfig {
            provider_name: "openai".into(), base_url: "https://api.openai.com/v1".into(),
            auth_header: Some("Authorization".into()), auth_value: Some(format!("Bearer {}", key)), extra_headers: vec![],
        });
        for question in ["Would you want to live there again in future?", "Why does ice float on water?",
            "Can you promise delivery by Friday?"] {
            let started = std::time::Instant::now();
            let output = CompletionOutput::private();
            let messages = vec![LLMMessage { role: "system".into(), content: super::ASSIST_PROMPT.into() },
                LLMMessage { role: "user".into(), content: format!("No personal profile or documents provided.\nLatest complete question: {}", question) }];
            let result = tokio::time::timeout(std::time::Duration::from_secs(30), client.stream_completion(
                messages, "gpt-4.1-mini-2025-04-14", GenerationParams { temperature: Some(0.2), max_tokens: Some(350), ..Default::default() }, output.clone())).await;
            assert!(matches!(result, Ok(Ok(_))), "Fixed prompt service probe failed; credentials are not logged");
            let text = output.text().unwrap();
            let lower = text.to_lowercase();
            for forbidden in ["based on the transcript", "no answer was recorded", "you might say", "sample response", "as an ai", "no clear answer"] {
                assert!(!lower.contains(forbidden), "Not a directly speakable answer: {}", text);
            }
            assert!(text.split_whitespace().count() <= 110, "Unexpectedly verbose spoken answer");
            println!("LIVE_SPOKEN_ANSWER elapsed_ms={} question={:?} answer={:?}", started.elapsed().as_millis(), question, text);
        }
    }
}

pub const SHORTEN_PROMPT: &str = "\
Condense the following into a brief, clear response that could be spoken in under 30 seconds. \
Preserve the core message and key points. Remove filler, redundancy, and secondary details. \
Output only the shortened version — no commentary or explanation. \
IMPORTANT: Respond in English only. The interface renders a separate Chinese translation.";

pub const FOLLOW_UP_PROMPT: &str = "\
Based on the meeting conversation, suggest 2-3 thoughtful follow-up questions the user could \
ask the other participants. Each question should demonstrate active listening, deepen the \
discussion, or clarify important points. Format as a numbered list. \
Make them specific to what was discussed, not generic. \
IMPORTANT: Respond in English only. The interface renders a separate Chinese translation.";

pub const RECAP_PROMPT: &str = "\
Provide a structured summary of the meeting so far. Include:\n\
- Key topics discussed\n\
- Decisions made\n\
- Action items and owners (if mentioned)\n\
- Outstanding questions or unresolved points\n\
Use bullet points for scannability. Be factual and concise — do not add interpretation.";

pub const MEETING_SUMMARY_PROMPT: &str = "\
Generate a comprehensive meeting summary from the full transcript provided.\n\
\n\
IMPORTANT formatting rules:\n\
- Use plain ## for section headers (e.g. ## Overview). Never wrap headers in bold (**) markers.\n\
- Use bullet points (- item) for lists.\n\
- Use a markdown table (with | separators) for Action Items.\n\
\n\
Structure the summary exactly as:\n\
\n\
## Overview\n\
A 1-2 sentence high-level description of what the meeting covered.\n\
\n\
## Key Discussion Points\n\
- Bullet points of the main topics discussed\n\
\n\
## Decisions Made\n\
- Any concrete decisions or agreements reached\n\
\n\
## Action Items\n\
| Task | Owner | Deadline / Timeline |\n\
|------|-------|---------------------|\n\
| Description of task | Person responsible | When it is due |\n\
\n\
## Open Questions\n\
- Unresolved points that need follow-up\n\
\n\
Be factual, concise, and base everything strictly on the transcript. Do not add speculation or interpretation.";

pub const ACTION_ITEMS_EXTRACTION_PROMPT: &str = "\
/no_think\n\
You are an AI assistant that extracts action items from meeting transcripts.\n\
\n\
Look broadly for ANY of these:\n\
- Explicit tasks or assignments (\"I will...\", \"Can you...\", \"Let's...\")\n\
- Follow-ups (\"We should check...\", \"I'll look into...\", \"Get back to me...\")\n\
- Commitments or promises (\"I'll send you...\", \"We'll schedule...\")\n\
- Decisions that require action (\"Let's go with...\", \"We agreed to...\")\n\
- Next steps discussed (\"The next step is...\", \"After this we need to...\")\n\
- Implied tasks from context (evaluating options, making decisions, sending documents)\n\
\n\
Be generous — if something sounds like it could be a task or follow-up, include it.\n\
\n\
Do NOT include any thinking, explanation, or preamble. Output ONLY a JSON array.\n\
\n\
Each element must have these fields:\n\
- \"text\": string - Clear, concise description of the action item\n\
- \"assignee_speaker_id\": string or null - speaker_id of the responsible person, or null\n\
- \"timestamp_ms\": number - Use 0 if unknown\n\
\n\
Example: [{\"text\":\"Evaluate all project options and make a decision\",\"assignee_speaker_id\":null,\"timestamp_ms\":0}]";

pub const BOOKMARK_SUGGESTIONS_PROMPT: &str = "\
/no_think\n\
You are an AI assistant that identifies key moments in meeting transcripts.\n\
\n\
Each transcript line starts with [SEGMENT_ID] followed by Speaker: text.\n\
Find the most important moments: decisions, agreements, topic transitions, \
action commitments, and notable statements.\n\
\n\
CRITICAL: Your entire response must be a single valid JSON array — no markdown, \
no headers, no bullet points, no explanation. Start with [ and end with ].\n\
\n\
Each element must have exactly these fields:\n\
- \"segment_id\": string — the exact [BRACKET_ID] from the transcript line\n\
- \"note\": string — brief description (10-20 words) of why this moment matters\n\
\n\
Return 5-8 of the most important moments.\n\
\n\
Example response (your output must follow this exact format):\n\
[{\"segment_id\":\"web_ab12_5\",\"note\":\"Agreed to submit grant proposal by Friday\"},{\"segment_id\":\"web_ab12_9\",\"note\":\"Decision to use Python for the new pipeline\"}]";

pub const ASK_QUESTION_PROMPT: &str = "\
The user has a specific question about the meeting or uploaded documents. Answer directly \
and helpfully based on all available context — transcript, documents, and meeting history. \
If the answer isn't clear from the context, say so. Be precise and cite specific parts of \
the discussion or documents when possible. \
IMPORTANT: Respond in English only. The interface renders a separate Chinese translation.";
