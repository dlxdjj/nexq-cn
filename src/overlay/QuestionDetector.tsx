import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { generateAssist } from "../lib/ipc";
import { translateAssistantText } from "../lib/assistantTranslation";
import { chineseAssistantError, looksLikeMeetingQuestion } from "../lib/meetingAssistant";
import { useTranscriptStore } from "../stores/transcriptStore";
import { useTranslationStore } from "../stores/translationStore";
import { useMeetingStore } from "../stores/meetingStore";
import { useStreamStore } from "../stores/streamStore";
import { useConfigStore } from "../stores/configStore";
import type { DetectedQuestion } from "../lib/types";

interface TrackedQuestion extends DetectedQuestion {
  id: string;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
}

export function QuestionDetector() {
  const [questions, setQuestions] = useState<TrackedQuestion[]>([]);
  const processed = useRef(new Set<string>());
  const pending = useRef(false);
  const segments = useTranscriptStore((s) => s.segments);
  const meetingId = useMeetingStore((s) => s.activeMeeting?.id);
  const model = useConfigStore((s) => s.llmModel);
  const busy = useStreamStore((s) => s.isStreaming || s.isRequesting);

  useEffect(() => {
    processed.current.clear();
    setQuestions([]);
  }, [meetingId]);

  // The transcript is the shared source of truth for all STT engines.
  // Segment IDs deduplicate backend/frontend events without suppressing a repeated question later.
  useEffect(() => {
    for (const segment of segments) {
      if (!segment.is_final || processed.current.has(segment.id)) continue;
      processed.current.add(segment.id);
      if (!["Them", "Interviewer"].includes(segment.speaker) || !looksLikeMeetingQuestion(segment.text)) continue;
      const question: TrackedQuestion = {
        id: segment.id, text: segment.text, source: segment.speaker,
        timestamp_ms: segment.timestamp_ms, confidence: 0.8, status: "idle",
      };
      setQuestions((previous) => [question, ...previous].slice(0, 10));
    }
  }, [segments, meetingId]);

  const handleAssist = useCallback(async (id: string) => {
    if (pending.current || useStreamStore.getState().isStreaming || useStreamStore.getState().isRequesting) return;
    const question = questions.find((item) => item.id === id);
    if (!question) return;
    pending.current = true;
    setQuestions((previous) => previous.map((item) => item.id === id ? { ...item, status: "loading", error: undefined } : item));
    try {
      await generateAssist("Assist", question.text);
      setQuestions((previous) => previous.map((item) => item.id === id ? { ...item, status: "ready" } : item));
    } catch (error) {
      setQuestions((previous) => previous.map((item) => item.id === id ? { ...item, status: "error", error: chineseAssistantError(error) } : item));
    } finally {
      pending.current = false;
    }
  }, [questions]);

  return (
    <div className="space-y-2" role="region" aria-label="检测到的问题">
      {!model && <p className="text-xs text-warning">回答模型未配置：可先查看转写，配置模型后生成推荐回复。</p>}
      {questions.length === 0 && <p className="text-xs text-muted-foreground">正在等待对方的英文问题；请确认“对方”音频已连接。</p>}
      {questions.slice(0, 4).map((question, index) => (
        <QuestionCard key={question.id} question={question} compact={index > 0} busy={busy}
          onAssist={() => void handleAssist(question.id)}
          onDismiss={() => setQuestions((previous) => previous.filter((item) => item.id !== question.id))} />
      ))}
    </div>
  );
}

function QuestionCard({ question, compact, busy, onAssist, onDismiss }: {
  question: TrackedQuestion; compact: boolean; busy: boolean; onAssist: () => void; onDismiss: () => void;
}) {
  const target = useTranslationStore((s) => s.targetLang || "zh");
  const source = useTranslationStore((s) => s.sourceLang);
  const provider = useTranslationStore((s) => s.provider);
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setTranslation(""); setError(false);
    translateAssistantText(question.text, target, source, provider)
      .then((result) => { if (!cancelled) setTranslation(result); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [question.text, target, source, provider, retry]);

  return (
    <section className={compact ? "rounded-lg border border-border/20 p-2" : "space-y-2"} data-no-ui-translate>
      <p className="text-[10px] font-semibold text-sky-400">对方英文问题</p>
      <p className={compact ? "line-clamp-2 text-xs" : "break-words text-sm font-medium"}>{question.text}</p>
      <p className="mt-1 text-[10px] font-semibold text-emerald-400">{target.startsWith("zh") ? "问题中文翻译" : "问题译文"}</p>
      {translation ? <p className="break-words text-xs text-foreground/80">{translation}</p>
        : error ? <button className="text-xs text-warning" onClick={() => setRetry((value) => value + 1)}>翻译失败，点击重试</button>
        : <p className="text-xs text-muted-foreground">正在翻译…</p>}
      {question.error && <p role="alert" className="text-xs text-warning">{question.error}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
        <button onClick={onAssist} disabled={busy || question.status === "loading"} className="flex items-center gap-1 rounded-lg bg-info/10 px-2 py-1 text-xs text-info disabled:opacity-50">
          {question.status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : question.status === "ready" ? <Check className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {question.status === "loading" ? "正在生成…" : question.status === "error" ? "重试生成" : question.status === "ready" ? "已生成 · 再次生成" : busy ? "等待当前回复完成" : "生成回复"}
        </button>
        <button aria-label="忽略问题" onClick={onDismiss} className="rounded p-1 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
      </div>
    </section>
  );
}
