// src/hooks/useTranslation.ts
import { useEffect, useRef } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  onTranslationResult,
  onTranslationError,
  onBatchTranslationProgress,
  onTranscriptFinal,
  onTranscriptUpdate,
} from "../lib/events";
import { useTranslationStore } from "../stores/translationStore";
import { useMeetingStore } from "../stores/meetingStore";
import { translateSegments, getMeetingTranslations } from "../lib/ipc";
import type { TranscriptUpdateEvent } from "../lib/types";
import { hasSpeechText } from "../lib/meetingAssistant";
import { useTranscriptStore } from "../stores/transcriptStore";

export function useTranslation(ownsAutoTranslation = false) {
  const addTranslation = useTranslationStore((s) => s.addTranslation);
  const addTranslations = useTranslationStore((s) => s.addTranslations);
  const setBatchProgress = useTranslationStore((s) => s.setBatchProgress);
  const autoTranslateActive = useTranslationStore((s) => s.autoTranslateActive);
  const targetLang = useTranslationStore((s) => s.targetLang);
  const sourceLang = useTranslationStore((s) => s.sourceLang);
  const setTranslating = useTranslationStore((s) => s.setTranslating);

  const activeMeeting = useMeetingStore((s) => s.activeMeeting);
  const meetingId = activeMeeting?.id ?? null;

  // Keep stable refs to avoid stale closures in async event handlers
  const addRef = useRef(addTranslation);
  const addTranslationsRef = useRef(addTranslations);
  const progressRef = useRef(setBatchProgress);
  const autoTranslateActiveRef = useRef(autoTranslateActive);
  const targetLangRef = useRef(targetLang);
  const sourceLangRef = useRef(sourceLang);
  const setTranslatingRef = useRef(setTranslating);
  const meetingIdRef = useRef(meetingId);

  useEffect(() => {
    addRef.current = addTranslation;
    addTranslationsRef.current = addTranslations;
    progressRef.current = setBatchProgress;
    autoTranslateActiveRef.current = autoTranslateActive;
    targetLangRef.current = targetLang;
    sourceLangRef.current = sourceLang;
    setTranslatingRef.current = setTranslating;
    meetingIdRef.current = meetingId;
  }, [addTranslation, addTranslations, setBatchProgress, autoTranslateActive, targetLang, sourceLang, setTranslating, meetingId]);

  // Subscribe to translation result/error/progress events
  useEffect(() => {
    let unResult: UnlistenFn | null = null;
    let unError: UnlistenFn | null = null;
    let unProgress: UnlistenFn | null = null;
    let mounted = true;

    const setup = async () => {
      const u1 = await onTranslationResult((result) => {
        if (!mounted) return;
        if (result.segment_id && meetingIdRef.current) {
          const segment = useTranscriptStore.getState().segments.find((s) => s.id === result.segment_id);
          if (!segment || !segment.text.startsWith(result.original_text) || result.target_lang !== targetLangRef.current) return;
        }
        addRef.current(result);
      });

      const u2 = await onTranslationError((error) => {
        if (!mounted) return;
        console.warn("[translation] Error:", error.error, error.segment_id);
        // Clear translating state for the failed segment so spinner doesn't hang
        if (error.segment_id) {
          setTranslatingRef.current(error.segment_id, false);
        }
      });

      const u3 = await onBatchTranslationProgress((progress) => {
        if (!mounted) return;
        progressRef.current(
          progress.completed >= progress.total ? null : progress,
        );
      });

      if (mounted) {
        unResult = u1;
        unError = u2;
        unProgress = u3;
      } else {
        u1();
        u2();
        u3();
      }
    };

    setup();

    return () => {
      mounted = false;
      if (unResult) unResult();
      if (unError) unError();
      if (unProgress) unProgress();
    };
  }, []);

  // Auto-translate: listen for final transcript segments and translate when active
  useEffect(() => {
    if (!ownsAutoTranslation) return;
    let unFinal: UnlistenFn | null = null;
    let unUpdate: UnlistenFn | null = null;
    let mounted = true;
    // Debounce timer ref per segment — stored as map of segmentId -> timeoutId
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const pending = new Map<string, () => Promise<void>>();
    const running = new Set<string>();
    const translated = new Map<string, string>();
    const pump = async (id: string) => {
      if (running.has(id)) return;
      running.add(id);
      try {
        while (mounted && pending.has(id)) {
          const job = pending.get(id)!;
          pending.delete(id);
          await job();
        }
      } finally { running.delete(id); }
    };

    const setup = async () => {
      const handle = (event: TranscriptUpdateEvent) => {
        if (!mounted) return;

        const { segment } = event;
        if (!hasSpeechText(segment.text)) return;
        if (!segment.is_final && !segment.id.includes("speech_turn_")) return;

        const active = autoTranslateActiveRef.current;
        const mid = meetingIdRef.current;
        if (!active || !mid) return;

        const segmentId = segment.id;

        // Clear any pending debounce for this segment
        const existing = debounceTimers.get(segmentId);
        if (existing !== undefined) {
          clearTimeout(existing);
        }

        // Debounce by 200ms to avoid rapid successive calls
        const timer = setTimeout(() => {
          debounceTimers.delete(segmentId);

          const currentActive = autoTranslateActiveRef.current;
          const currentMid = meetingIdRef.current;
          const currentTarget = targetLangRef.current;
          const currentSource = sourceLangRef.current;

          if (!currentActive || currentMid !== mid || !currentTarget) return;
          const key = JSON.stringify([currentMid, currentSource, currentTarget, segment.text]);
          pending.set(segmentId, async () => {
            if (!mounted || meetingIdRef.current !== currentMid || !autoTranslateActiveRef.current || translated.get(segmentId) === key) return;
            setTranslatingRef.current(segmentId, true);
            try {
              await translateSegments([segmentId], [segment.text], currentMid, currentTarget,
                currentSource === "auto" ? undefined : currentSource);
              translated.set(segmentId, key);
            } catch (err) {
              console.error("[useTranslation] Auto-translate failed:", err);
              setTranslatingRef.current(segmentId, false);
            }
          });
          void pump(segmentId);
        }, 200);

        debounceTimers.set(segmentId, timer);
      };
      const u = await onTranscriptFinal(handle);
      const u2 = await onTranscriptUpdate(handle);

      if (mounted) {
        unFinal = u;
        unUpdate = u2;
      } else {
        u();
        u2();
      }
    };

    setup();

    return () => {
      mounted = false;
      // Clear all pending debounce timers
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      pending.clear();
      if (unFinal) unFinal();
      if (unUpdate) unUpdate();
    };
  }, [ownsAutoTranslation]);

  // Preload cached translations when meeting ID or target language changes
  useEffect(() => {
    if (!meetingId || !targetLang) return;
    getMeetingTranslations(meetingId, targetLang)
      .then((cached) => {
        if (cached.length > 0) {
          addTranslationsRef.current(cached);
        }
      })
      .catch((err) =>
        console.warn("[useTranslation] Failed to preload translations:", err),
      );
  }, [meetingId, targetLang]);
}
