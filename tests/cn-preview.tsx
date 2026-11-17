// Development-only fixture. Not imported into or bundled with the desktop app.
import React from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import "../src/index.css";

const question = "How do you protect customer data, and how long does deployment take?";
const reply = "We encrypt customer data at rest and in transit. Standard deployment takes ten business days. I can confirm the scope with our delivery team.";
const dictionary: Record<string, string> = {
  [question]: "你们如何保护客户数据？部署需要多长时间？",
  "We encrypt customer data at rest and in transit.": "我们对存储和传输中的客户数据进行加密。",
  "Standard deployment takes ten business days.": "标准部署需要十个工作日。",
  "I can confirm the scope with our delivery team.": "我可以和交付团队确认具体范围。",
  "What is the price?": "价格是多少？",
  "I will confirm the price.": "我会确认价格。",
  "Possibly. It would depend on my work and lifestyle at the time.": "有可能。这取决于我当时的工作和生活方式。",
  "I'd want to see how the city has changed before making a decision.": "我想先看看这座城市发生了什么变化，再做决定。",
};
const stats = { generations: 0, translations: 0, transcriptTranslations: 0, lastQuestion: "", ended: false, failGeneration: false, failTranslation: false, starts: 0, muteCalls: 0, shortcutRegistrations: 0 };
let cancelled = false;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const appWindow = new URLSearchParams(location.search).get("app");
mockWindows(appWindow || "launcher", appWindow === "overlay" ? "launcher" : "overlay");
mockIPC(async (command, raw) => {
  const args = raw as Record<string, any>;
  if (command === "translate_segments") {
    stats.transcriptTranslations++;
    await delay(120);
    await emit("translation_result", { segment_id: args.segmentIds[0], original_text: args.texts[0],
      translated_text: "字幕译文：" + args.texts[0], source_lang: "en", target_lang: "zh", provider: "模拟服务" });
    return;
  }
  if (command === "translate_text") {
    stats.translations++;
    await delay(80);
    if (stats.failTranslation) throw new Error("Translation timed out");
    return { original_text: args.text, translated_text: dictionary[args.text] || "模拟译文：" + args.text, source_lang: "en", target_lang: "zh", provider: "模拟翻译" };
  }
  if (command === "generate_assist") {
    stats.generations++;
    stats.lastQuestion = args.customQuestion;
    if (stats.failGeneration) throw new Error("No active model selected");
    cancelled = false;
    const oralPractice = (args.customQuestion || "").startsWith("Would you want to live there");
    await emit("llm_stream_start", {
      mode: args.mode, model: "界面测试模型", provider: "模拟服务",
      question: args.customQuestion || question, rag_status: oralPractice ? "no_index" : "matched", include_rag: true,
      web_search_status: oralPractice ? undefined : "matched",
      rag_chunks: oralPractice ? [] : [{ source: "示例产品资料.md（虚构测试资料）", chunk_index: 0, text: "Customer data is encrypted at rest and in transit. Standard deployment: ten business days.", normalized_score: 0.8, raw_score: 0.8 }],
    });
    const chunks = oralPractice
      ? ["Possibly. It would depend on my work and lifestyle at the time. ", "I'd want to see how the city has changed before making a decision."]
      : ["We encrypt customer data at rest and in transit. ", "Standard deployment takes ten business days. ", "I can confirm the scope with our delivery team."];
    for (const token of chunks) {
      if (cancelled) { await emit("llm_stream_error", "Generation cancelled"); throw new Error("Generation cancelled"); }
      await emit("llm_stream_token", { token });
      await delay(800);
    }
    if (!oralPractice) await emit("llm_stream_sources", { sources: [{ title: "示例网页来源", url: "https://example.com/reference" }] });
    await emit("llm_stream_end", { total_tokens: 35, latency_ms: 2400 });
    return;
  }
  if (command === "cancel_generation") { cancelled = true; return; }
  if (command === "set_source_muted") { stats.muteCalls++; return; }
  if (command === "plugin:global-shortcut|register") { stats.shortcutRegistrations++; return; }
  if (command === "plugin:webview|get_all_webviews") return [];
  if (command === "has_api_key") return false;
  if (command === "list_local_stt_engines") return "[]";
  if (command === "get_recording_enabled") return false;
  if (command === "plugin:store|load") return 1;
  if (command === "plugin:store|get") return [null, false];
  return null;
}, { shouldMockEvents: true });

const { OverlayView } = await import("../src/overlay/OverlayView");
const { useStreamBuffer } = await import("../src/hooks/useStreamBuffer");
const { useAutomaticAssist } = await import("../src/hooks/useAutomaticAssist");
const { useTranscriptStore } = await import("../src/stores/transcriptStore");
const { useStreamStore } = await import("../src/stores/streamStore");
const { useMeetingStore } = await import("../src/stores/meetingStore");
const { useConfigStore } = await import("../src/stores/configStore");
const { useAIActionsStore } = await import("../src/stores/aiActionsStore");
const { useTranslationStore } = await import("../src/stores/translationStore");
const { useSpeakerStore } = await import("../src/stores/speakerStore");
const { useTranscript } = await import("../src/hooks/useTranscript");
const { useTranslation } = await import("../src/hooks/useTranslation");
const { installChineseUi } = await import("../src/lib/chineseUi");
installChineseUi();
useConfigStore.setState({ llmModel: "界面测试模型", recordingEnabled: false, overlayOpacity: 1, pauseThresholdMs: 1000 });
useAIActionsStore.setState({ configs: { ...useAIActionsStore.getState().configs, globalDefaults: { ...useAIActionsStore.getState().configs.globalDefaults, autoTrigger: false } } });
useMeetingStore.setState({
  activeMeeting: { id: "fixture", title: "Teams 双语会议 · 模拟数据", start_time: new Date().toISOString() } as any,
  currentView: "overlay", isRecording: true, elapsedMs: 65000,
  endMeetingFlow: async () => { stats.ended = true; },
});
let fixtureTimestamp = 65000;
const seed = (text = question, id = crypto.randomUUID()) => {
  fixtureTimestamp += 1000;
  useTranscriptStore.getState().updateInterimSegment({ id, text, speaker: "Them", timestamp_ms: fixtureTimestamp, is_final: true } as any);
  useTranslationStore.getState().addTranslation({ segment_id: id, original_text: text, translated_text: dictionary[text] || "模拟问题", source_lang: "en", target_lang: "zh", provider: "模拟翻译" });
};
seed();
(window as any).__cnTest = {
  stats, seed,
  segments: () => useTranscriptStore.getState().segments,
  speakers: () => useSpeakerStore.getState().speakers,
  resetSpeakers: () => useSpeakerStore.getState().reset(),
  translateLive: () => useTranslationStore.setState({ autoTranslateActive: true, targetLang: "zh", sourceLang: "en", displayMode: "inline" }),
  streaming: () => useStreamStore.getState().isStreaming,
  noMatch: () => useStreamStore.setState({ currentEvidence: { status: "no_match", chunks: [] } }),
  newReply: (content: string) => { useStreamStore.getState().startStream("Assist", "模拟", "模拟"); useStreamStore.getState().appendToken(content); useStreamStore.getState().endStream(0); },
  automatic: (enabled: boolean) => useAIActionsStore.setState({ configs: { ...useAIActionsStore.getState().configs, globalDefaults: { ...useAIActionsStore.getState().configs.globalDefaults, autoTrigger: enabled } } }),
  clear: () => { useStreamStore.getState().clearCurrent(); useStreamStore.setState({ responseHistory: [] }); useTranscriptStore.getState().clearSegments(); },
  emit,
};
function Preview() {
  useTranscript();
  useTranslation(true);
  useStreamBuffer();
  useAutomaticAssist();
  return <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    <p className="shrink-0 bg-amber-950 px-3 py-1 text-xs text-amber-200">本地界面测试 · 虚构资料与模拟服务 · 非真实 Teams／AI 效果</p>
    <div className="min-h-0 flex-1"><OverlayView /></div>
  </div>;
}
if (appWindow) {
  const { useContextStore } = await import("../src/stores/contextStore");
  const { useRagStore } = await import("../src/stores/ragStore");
  const noop = async () => {};
  useConfigStore.setState({ _loaded: true, firstRunCompleted: true, startOnLogin: false, loadConfig: noop });
  useAIActionsStore.setState({ loadConfigs: noop });
  useTranslationStore.setState({ loadConfig: noop });
  useMeetingStore.setState({ activeMeeting: null, isRecording: false, loadRecentMeetings: noop, startMeetingFlow: async () => { stats.starts++; } });
  useContextStore.setState({ loadResources: noop, refreshTokenBudget: noop });
  useRagStore.setState({ refreshIndexStatus: noop });
  const { default: App } = await import("../src/App");
  createRoot(document.getElementById("root")!).render(<App />);
} else {
  createRoot(document.getElementById("root")!).render(<Preview />);
}
