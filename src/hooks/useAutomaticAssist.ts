import { useEffect, useRef } from "react";
import { useTranscriptStore } from "../stores/transcriptStore";
import { useStreamStore } from "../stores/streamStore";
import { useAIActionsStore } from "../stores/aiActionsStore";
import { useConfigStore } from "../stores/configStore";
import { useMeetingStore } from "../stores/meetingStore";
import { generateAssist } from "../lib/ipc";
import { looksLikeMeetingQuestion } from "../lib/meetingAssistant";

/** Launcher-only: one automatic request after the other party stops speaking. */
export function useAutomaticAssist() {
  const segments = useTranscriptStore((s) => s.segments);
  const enabled = useAIActionsStore((s) => s.configs.globalDefaults.autoTrigger);
  const delay = useConfigStore((s) => s.pauseThresholdMs);
  const model = useConfigStore((s) => s.llmModel);
  const muted = useConfigStore((s) => s.mutedThem);
  const busy = useStreamStore((s) => s.isStreaming || s.isRequesting);
  const currentQuestion = useStreamStore((s) => s.currentQuestion);
  const meetingId = useMeetingStore((s) => s.activeMeeting?.id);
  const attempted = useRef(new Set<string>());
  useEffect(() => { attempted.current.clear(); }, [meetingId]);
  useEffect(() => {
    if (!enabled || !model || muted || !meetingId) return;
    const remote = segments.filter((segment) => ["Them", "Interviewer"].includes(segment.speaker));
    if (!remote.length || !remote[remote.length - 1].is_final) return;
    const question = remote[remote.length - 1];
    if (!looksLikeMeetingQuestion(question.text)) return;
    const questionKey = `${question.id}:${question.text}`;
    if (attempted.current.has(questionKey)) return;
    if (busy) {
      if (currentQuestion === question.text) attempted.current.add(questionKey);
      return;
    }
    // Do not auto-answer a stale question after moving on to another topic.
    if (remote[remote.length - 1].timestamp_ms - question.timestamp_ms > 30000) return;
    const timer = window.setTimeout(async () => {
      if (useMeetingStore.getState().activeMeeting?.id !== meetingId) return;
      attempted.current.add(questionKey);
      try {
        await generateAssist("Assist", question.text);
      } catch (error) {
        if (String(error).includes("already in progress")) attempted.current.delete(questionKey);
        // IPC exposes other errors. Do not repeatedly retry a failed service automatically.
      }
    // Managed speech turns already waited for acoustic silence. Do not add the
    // legacy three-second segmentation delay a second time.
    }, question.id.includes("speech_turn_") ? 350 : Math.max(1000, delay || 3000));
    return () => window.clearTimeout(timer);
  }, [segments, enabled, model, busy, currentQuestion, muted, meetingId, delay]);
}
