import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMeetingStore } from "../stores/meetingStore";
import { useScenarioStore } from "../stores/scenarioStore";
import { useCallLogStore } from "../stores/callLogStore";
import { useAIActionsStore } from "../stores/aiActionsStore";
import { useTranslationStore } from "../stores/translationStore";
import { showToast } from "../stores/toastStore";
import { requestMeetingEnd } from "../lib/meetingControl";
import { translateBatch, setSourceMuted } from "../lib/ipc";
import { TranscriptPanel } from "./TranscriptPanel";
import { QuestionDetector } from "./QuestionDetector";
import { AIResponsePanel } from "./AIResponsePanel";
import { ModeButtons } from "./ModeButtons";
import { AskInput } from "./AskInput";
import { ServiceStatusBar } from "../components/ServiceStatusBar";
import { DevLogPanel } from "../components/DevLogPanel";
import { SpeakerStatsPanel } from "./SpeakerStatsPanel";
import { BookmarkToast } from "./BookmarkToast";
import { BookmarkPanel } from "./BookmarkPanel";
import { useBookmarkHotkey } from "../hooks/useBookmarkHotkey";
import { useMeetingShortcuts } from "../hooks/useMeetingShortcuts";
import { useConfigStore } from "../stores/configStore";
import { useSpeakerDetection } from "../hooks/useSpeakerDetection";
import { useTopicDetection } from "../hooks/useTopicDetection";
import { MODE_COLORS } from "../lib/speakerColors";
import { showLauncherWindow } from "../lib/windows";
import {
  GripHorizontal,
  Minus,
  Settings,
  Square,
  Activity,
  Terminal,
  BarChart3,
  Bookmark,
  Globe,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Columns2,
  PanelLeftClose,
  PanelRightClose,
  Eye,
} from "lucide-react";
import { formatDuration } from "../lib/utils";

// ════════════════════════════════════════════════════════════════
export function OverlayView() {
  const activeMeeting = useMeetingStore((s) => s.activeMeeting);
  const elapsedMs = useMeetingStore((s) => s.elapsedMs);
  const recordingEnabled = useConfigStore((s) => s.recordingEnabled);
  const audioMode = useMeetingStore((s) => s.audioMode);
  const endMeetingFlow = useMeetingStore((s) => s.endMeetingFlow);
  const setCurrentView = useMeetingStore((s) => s.setCurrentView);
  const scenarioTemplate = useScenarioStore((s) => s.getActiveTemplate());
  const [askInputVisible, setAskInputVisible] = useState(false);
  const [devLogOpen, setDevLogOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"split" | "ai" | "transcript">("split");
  const [narrow, setNarrow] = useState(window.innerWidth < 700);
  useEffect(() => {
    const resize = () => setNarrow(window.innerWidth < 700);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const effectiveLayout = narrow && layoutMode === "split" ? "ai" : layoutMode;
  const cycleLayout = () => setLayoutMode((m) => narrow ? (m === "transcript" ? "ai" : "transcript") : m === "split" ? "ai" : m === "ai" ? "transcript" : "split");
  const toggleLog = useCallLogStore((s) => s.toggleOpen);
  const logOpen = useCallLogStore((s) => s.isOpen);
  const autoTrigger = useAIActionsStore((s) => s.configs.globalDefaults.autoTrigger);

  const mutedYou = useConfigStore((s) => s.mutedYou);
  const mutedThem = useConfigStore((s) => s.mutedThem);
  const toggleMuteYou = useConfigStore((s) => s.toggleMuteYou);
  const toggleMuteThem = useConfigStore((s) => s.toggleMuteThem);
  const overlayOpacity = useConfigStore((s) => s.overlayOpacity);
  const setOverlayOpacity = useConfigStore((s) => s.setOverlayOpacity);
  const OPACITY_PRESETS = [0.9, 0.65, 0.35, 0.1];
  const cycleOpacity = () => {
    const idx = OPACITY_PRESETS.findIndex((p) => Math.abs(p - overlayOpacity) < 0.08);
    setOverlayOpacity(OPACITY_PRESETS[(idx + 1) % OPACITY_PRESETS.length]);
  };

  const autoTranslateActive = useTranslationStore((s) => s.autoTranslateActive);
  const setAutoTranslateActive = useTranslationStore((s) => s.setAutoTranslateActive);
  const displayMode = useTranslationStore((s) => s.displayMode);
  const setDisplayMode = useTranslationStore((s) => s.setDisplayMode);
  const targetLang = useTranslationStore((s) => s.targetLang);
  const provider = useTranslationStore((s) => s.provider);
  const batchProgress = useTranslationStore((s) => s.batchProgress);
  const isBatchTranslating = batchProgress !== null;

  // Bookmark hotkey (Ctrl+B) — also returns addBookmarkAtNow for shortcut hook
  const addBookmarkAtNow = useBookmarkHotkey(false);

  // Consolidated keyboard shortcuts for live meeting
  const shortcutActions = useMemo(
    () => ({
      addBookmark: addBookmarkAtNow,
      toggleStats: () => setStatsOpen((p) => !p),
      toggleBookmarks: () => setBookmarksOpen((p) => !p),
      toggleMute: () => useConfigStore.getState().toggleMuteYou(),
      closeAllPanels: () => {
        setStatsOpen(false);
        setBookmarksOpen(false);
        setDevLogOpen(false);
      },
      toggleDevLog: () => setDevLogOpen((p) => !p),
    }),
    [addBookmarkAtNow],
  );
  useMeetingShortcuts(shortcutActions);

  // Speaker detection from Deepgram diarization events
  useSpeakerDetection();

  // Live topic detection from backend events
  useTopicDetection();


  const [ending, setEnding] = useState(false);
  const [pausing, setPausing] = useState(false);
  const pauseSnapshot = useRef<{ you: boolean; them: boolean } | null>(null);
  const recognitionPaused = mutedYou && mutedThem;
  const handlePause = async () => {
    if (pausing) return;
    setPausing(true);
    const previous = { you: mutedYou, them: mutedThem };
    const restore = pauseSnapshot.current || { you: false, them: false };
    const desired = recognitionPaused ? restore : { you: true, them: true };
    try {
      await setSourceMuted("you", desired.you);
      await setSourceMuted("them", desired.them);
      useConfigStore.setState({ mutedYou: desired.you, mutedThem: desired.them });
      pauseSnapshot.current = recognitionPaused ? null : previous;
    } catch (error) {
      await Promise.allSettled([setSourceMuted("you", previous.you), setSourceMuted("them", previous.them)]);
      useConfigStore.setState({ mutedYou: previous.you, mutedThem: previous.them });
      showToast("暂停识别失败，请检查音频服务", "error");
    } finally { setPausing(false); }
  };
  const handleEndMeeting = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    try { await requestMeetingEnd(); showToast("会议已结束", "info"); }
    catch (err) { showToast(err instanceof Error ? err.message : "无法结束会议", "error"); }
    finally { setEnding(false); }
  }, [ending]);

  const handleTranslateAll = useCallback(async () => {
    const meetingId = activeMeeting?.id;
    if (!meetingId || !targetLang) return;
    try {
      const { total, alreadyDone, newlyTranslated } = await translateBatch(meetingId, targetLang);
      if (newlyTranslated === 0) {
        showToast(`All ${total} segments already translated`, "info");
      } else if (alreadyDone > 0) {
        showToast(`Translated ${newlyTranslated} new segments (${alreadyDone} already cached, ${total} total)`, "success");
      } else {
        showToast(`Translated all ${total} segments`, "success");
      }
    } catch (err) {
      showToast(`Batch translation failed: ${err}`, "error");
    }
  }, [activeMeeting?.id, targetLang]);

  const handleMinimizeToDashboard = useCallback(() => {
    setCurrentView("launcher");
    showLauncherWindow().catch(() => {});
  }, [setCurrentView]);

  const meetingTitle = activeMeeting?.title || "NexQ";

  return (
    <div className="overlay-bg flex h-full flex-col rounded-xl border border-border/20 shadow-xl" style={{ background: `hsl(var(--background) / ${overlayOpacity})`, backdropFilter: overlayOpacity > 0.7 ? "blur(12px) saturate(1.1)" : "none" }}>

      {/* Essential controls never share a horizontally overflowing toolbar. */}
      <header className="shrink-0 border-b border-border/20">
        <div className="no-select flex min-w-0 items-center gap-2 px-3 py-2" data-tauri-drag-region>
          <GripHorizontal className="h-3 w-3 shrink-0 text-muted-foreground/50" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={meetingTitle} data-no-ui-translate data-tauri-drag-region>{meetingTitle}</span>
          <span className="shrink-0 text-xs tabular-nums">{formatDuration(elapsedMs)}</span>
          <button onClick={handlePause} disabled={pausing || ending} className="shrink-0 rounded-lg border border-border/40 px-2 py-1.5 text-xs disabled:opacity-50"
            title="暂停双方语音识别和自动回复；如果已开启录音，录音仍会继续。要停止采集请结束会议。">
            {pausing ? "处理中…" : recognitionPaused ? "恢复识别" : "暂停识别"}
          </button>
          <button onClick={handleEndMeeting} disabled={ending} aria-label="结束会议" className="flex shrink-0 items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/15 px-2 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50">
            <Square className="h-3 w-3 fill-current" />{ending ? "正在结束…" : "结束会议"}
          </button>
        </div>
        <div className="flex max-h-24 flex-wrap items-center gap-1 overflow-y-auto px-3 pb-2" aria-label="会议工具栏">
          <span className="rounded bg-accent/30 px-2 py-1 text-[10px]">{audioMode === "online" ? "线上会议" : "现场会议"} · {recordingEnabled ? "正在录音" : "不保存录音"}</span>
          <button onClick={() => useAIActionsStore.getState().updateGlobalDefaults({ autoTrigger: !autoTrigger })} aria-pressed={autoTrigger} className="rounded bg-primary/10 px-2 py-1 text-[10px] text-primary">
            {autoTrigger ? "自动回复：开" : "自动回复：关"}
          </button>
          <HeaderBtn icon={mutedYou ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />} active={mutedYou} onClick={toggleMuteYou} tooltip={mutedYou ? "恢复我的语音识别" : "暂停我的语音识别"} />
          <HeaderBtn icon={mutedThem ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />} active={mutedThem} onClick={toggleMuteThem} tooltip={mutedThem ? "恢复对方语音识别" : "暂停对方语音识别"} />
          <HeaderBtn icon={<Columns2 className="h-3.5 w-3.5" />} onClick={cycleLayout} tooltip="切换双栏／回复／转写布局" />
          <HeaderBtn icon={<Settings className="h-3.5 w-3.5" />} onClick={() => setCurrentView("settings")} tooltip="设置" />
          <HeaderBtn icon={<Minus className="h-3.5 w-3.5" />} onClick={handleMinimizeToDashboard} tooltip="返回主窗口（会议继续）" />
          <button onClick={() => setAutoTranslateActive(!autoTranslateActive)} aria-pressed={autoTranslateActive} className="rounded bg-primary/10 px-2 py-1 text-[10px] text-primary">{autoTranslateActive ? "转写翻译：开" : "转写翻译：关"}</button>
          <button onClick={handleTranslateAll} disabled={isBatchTranslating} className="rounded px-2 py-1 text-[10px] text-muted-foreground disabled:opacity-50">{isBatchTranslating ? "正在翻译…" : "补译全部转写"}</button>
          <HeaderBtn icon={<Bookmark className="h-3.5 w-3.5" />} active={bookmarksOpen} onClick={() => setBookmarksOpen(p => !p)} tooltip="书签（B 添加，K 查看）" />
          <HeaderBtn icon={<Activity className="h-3.5 w-3.5" />} active={logOpen} onClick={toggleLog} tooltip="AI 调用日志" />
          <HeaderBtn icon={<BarChart3 className="h-3.5 w-3.5" />} active={statsOpen} onClick={() => setStatsOpen(p => !p)} tooltip="发言统计" />
          <HeaderBtn icon={<Eye className="h-3.5 w-3.5" />} onClick={cycleOpacity} tooltip={`窗口不透明度 ${Math.round(overlayOpacity * 100)}%`} />
        </div>
        {recognitionPaused && <p className="px-3 pb-2 text-[10px] text-warning">双方识别已暂停；{recordingEnabled ? "录音仍在继续，停止采集请点击“结束会议”" : "未开启录音保存"}。</p>}
      </header>

      {/* ═══ MAIN ═══ */}
      <div className="relative flex-1 min-h-0">
      <div className="absolute inset-0 flex flex-nowrap gap-2.5 overflow-hidden px-3 py-2.5">

        {/* ── LEFT: TRANSCRIPT ── */}
        {effectiveLayout !== "ai" ? (
          <div className="flex min-w-0 min-h-0 flex-1 basis-[220px] flex-col overflow-hidden rounded-xl bg-card/20">
            <div className="flex shrink-0 items-center border-b border-border/20 px-3 py-1.5">
              <span className="text-meta font-semibold uppercase tracking-wider text-muted-foreground/60">会议转写 · 中英对照</span>
            </div>
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden p-2.5">
              <TranscriptPanel />
            </div>
          </div>
        ) : (
          <div
            className="flex min-h-0 w-8 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl bg-card/20 transition-all duration-200 hover:bg-card/30"
            onClick={() => setLayoutMode(narrow ? "transcript" : "split")}
            role="button"
            aria-label="展开转写面板"
            title="展开转写"
          >
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              会议转写
            </span>
          </div>
        )}

        {/* ── RIGHT ── */}
        {effectiveLayout !== "transcript" ? (
        <div className="flex min-w-0 min-h-0 flex-1 basis-[220px] flex-col gap-2.5 overflow-hidden">
          {/* Question cards remain available in manual mode. */}
          {(
            <div className="max-h-[35%] shrink-0 overflow-y-auto rounded-xl border border-info/10 bg-info/5 px-3 py-2">
              <QuestionDetector />
            </div>
          )}

          {/* AI Response */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card/20">
            <div className="flex shrink-0 items-center gap-1 border-b border-border/20 px-2.5 py-1.5">
              <ModeButtons />
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <AIResponsePanel />
            </div>
          </div>
        </div>
        ) : (
          <div
            className="flex min-h-0 w-8 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl bg-card/20 transition-all duration-200 hover:bg-card/30"
            onClick={() => setLayoutMode(narrow ? "ai" : "split")}
            role="button"
            aria-label="展开回复面板"
            title="展开回复面板"
          >
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              AI
            </span>
          </div>
        )}
      </div>
      </div>

      {/* Ask input */}
      {askInputVisible && (
        <div className="border-t border-border/20 px-3 py-1.5 slide-down-enter">
          <AskInput visible={askInputVisible} onClose={() => setAskInputVisible(false)} />
        </div>
      )}

      {/* DevLog panel */}
      <DevLogPanel open={devLogOpen} onClose={() => setDevLogOpen(false)} />

      {/* Speaker Stats */}
      {statsOpen && (
        <div className="border-t border-border/20 px-3 py-2">
          <SpeakerStatsPanel isOpen={statsOpen} />
        </div>
      )}

      {/* Bookmark panel */}
      {bookmarksOpen && <BookmarkPanel />}

      {/* Bookmark toast (manages its own visibility) */}
      <BookmarkToast />

      {/* ═══ FOOTER: Service Status ═══ */}
      <div className="border-t border-border/20">
        <ServiceStatusBar compact />
      </div>
    </div>
  );
}

// ── Header Button ──
function HeaderBtn({ icon, active, onClick, tooltip }: { icon: React.ReactNode; active?: boolean; onClick: () => void; tooltip: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg p-2 transition-all duration-150 cursor-pointer ${
        active ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:bg-accent/60 hover:text-foreground"
      }`}
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={active}
    >
      {icon}
    </button>
  );
}


