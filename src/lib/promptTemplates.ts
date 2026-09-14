// ============================================================================
// NexQ Prompt Templates — TypeScript mirror of src-tauri/src/intelligence/prompt_templates.rs
// Reads from aiActionsStore first, falls back to hardcoded defaults.
// ============================================================================
import type { IntelligenceMode } from "./types";
import { useAIActionsStore } from "../stores/aiActionsStore";
import spokenReplyPrompt from "./spokenReplyPrompt.txt?raw";

const DEFAULT_PROMPTS: Record<IntelligenceMode, string> = {
  Assist: spokenReplyPrompt,
  WhatToSay: spokenReplyPrompt,
  Shorten:
    "Condense the following into a brief, clear response. " +
    "Keep the key points but make it concise enough to speak in 30 seconds or less. " +
    "Preserve the core message and any critical details. " +
    "Output only the shortened version with no extra commentary. " +
    "Respond in English only; the interface renders a separate Chinese translation.",
  FollowUp:
    "Based on the meeting transcript, suggest 2-3 insightful follow-up questions " +
    "the user could ask. Format as a numbered list. " +
    "Each question should demonstrate engagement and understanding of the topic. " +
    "Make the questions specific to the conversation, not generic. " +
    "Respond in English only; the interface renders a separate Chinese translation.",
  Recap:
    "Provide a concise summary of the meeting so far. Include:\n" +
    "- Key topics discussed\n" +
    "- Decisions made\n" +
    "- Action items mentioned\n" +
    "- Any outstanding questions\n" +
    "Keep the summary structured and scannable. Use bullet points.",
  AskQuestion:
    "You are an AI assistant in a meeting. Answer the user's specific question based on " +
    "the meeting context and any provided documents. Be direct and helpful. " +
    "If you don't have enough context to answer confidently, say so clearly. " +
    "Respond in English only; the interface renders a separate Chinese translation.",
  MeetingSummary:
    "Generate a comprehensive meeting summary from the full transcript. Include:\n" +
    "- Overview (1-2 sentences)\n" +
    "- Key Discussion Points\n" +
    "- Decisions Made\n" +
    "- Action Items\n" +
    "- Open Questions\n" +
    "Be factual, concise, and base everything strictly on the transcript.",
  ActionItemsExtraction:
    "You are an AI assistant that extracts action items from meeting transcripts. " +
    "Analyze the transcript and identify all action items, tasks, follow-ups, and commitments made by participants.\n\n" +
    "Return ONLY a valid JSON array with no other text, no markdown formatting, no code fences. " +
    "Each element must have exactly these fields:\n" +
    '- "text": string - Clear, concise description of the action item\n' +
    '- "assignee_speaker_id": string or null - The speaker_id of the person responsible (from the speaker list provided), or null if unclear\n' +
    '- "timestamp_ms": number - The approximate timestamp in milliseconds where the action item was discussed',
  BookmarkSuggestions:
    "You are an AI assistant that identifies key moments in meeting transcripts. " +
    "Analyze the transcript and find the most important moments: decisions, agreements, topic transitions, action commitments, and notable statements.\n\n" +
    "Return ONLY a valid JSON array with no other text, no markdown formatting, no code fences. " +
    "Each element must have exactly these fields:\n" +
    '- "timestamp_ms": number - The timestamp in milliseconds of the key moment\n' +
    '- "segment_id": string or null - The transcript segment ID closest to this moment, if identifiable\n' +
    '- "note": string - A brief description of why this moment is important (max 100 chars)\n\n' +
    "Limit to the 10 most important moments.",
};

export function getSystemPromptForMode(mode: IntelligenceMode): string {
  // Try to read from the AI actions store
  const actions = useAIActionsStore.getState().configs.actions;
  const actionConfig = actions[mode];
  if (actionConfig?.systemPrompt) {
    return actionConfig.systemPrompt;
  }
  return DEFAULT_PROMPTS[mode] ?? DEFAULT_PROMPTS.Assist;
}
