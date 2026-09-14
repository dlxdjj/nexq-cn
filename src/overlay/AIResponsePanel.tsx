import { useState, useCallback, useRef, useEffect } from "react";
import { useStreamStore } from "../stores/streamStore";
import {
  Sparkles,
  Loader2,
  Pin,
  PinOff,
  Copy,
  Check,
  Globe,
} from "lucide-react";
import { BilingualResponseContent } from "./BilingualResponseContent";
import { KnowledgeEvidence } from "./KnowledgeEvidence";
import { chineseAssistantError } from "../lib/meetingAssistant";
import { getModeLabel } from "../lib/utils";
import type { AIResponse, StreamSource } from "../lib/types";
import { useMeetingStore } from "../stores/meetingStore";
import { useConfigStore } from "../stores/configStore";
import { ColorPickerButton } from "../components/ColorPickerButton";

type TabId = "current" | "history-0" | "history-1" | string;

// Sub-PRD 6: Streaming markdown, response history tabs, pin/copy
export function AIResponsePanel() {
  const isStreaming = useStreamStore((s) => s.isStreaming);
  const isRequesting = useStreamStore((s) => s.isRequesting);
  const currentContent = useStreamStore((s) => s.currentContent);
  const currentMode = useStreamStore((s) => s.currentMode);
  const error = useStreamStore((s) => s.error);
  const currentId = useStreamStore((s) => s.currentId);
  const currentQuestion = useStreamStore((s) => s.currentQuestion);
  const currentEvidence = useStreamStore((s) => s.currentEvidence);
  const currentSources = useStreamStore((s) => s.currentSources);
  const responseHistory = useStreamStore((s) => s.responseHistory);
  const pinnedResponses = useStreamStore((s) => s.pinnedResponses);
  const pinResponse = useStreamStore((s) => s.pinResponse);
  const unpinResponse = useStreamStore((s) => s.unpinResponse);

  const aiResponseFontSize = useConfigStore((s) => s.aiResponseFontSize ?? 12);
  const aiResponseTextColor = useConfigStore((s) => s.aiResponseTextColor ?? "#d4d4d8");
  const aiResponseLineHeight = useConfigStore((s) => s.aiResponseLineHeight ?? 1.6);
  const aiResponseHPad = useConfigStore((s) => s.aiResponseHPad ?? 0);
  const aiResponseAlign = useConfigStore((s) => s.aiResponseAlign ?? "left");
  const setAiResponseFontSize = useConfigStore((s) => s.setAiResponseFontSize);
  const setAiResponseTextColor = useConfigStore((s) => s.setAiResponseTextColor);
  const setAiResponseLineHeight = useConfigStore((s) => s.setAiResponseLineHeight);
  const setAiResponseHPad = useConfigStore((s) => s.setAiResponseHPad);
  const setAiResponseAlign = useConfigStore((s) => s.setAiResponseAlign);

  const proseStyle = {
    fontSize: `${aiResponseFontSize}px`,
    color: aiResponseTextColor,
    lineHeight: aiResponseLineHeight,
    paddingLeft: `${aiResponseHPad}px`,
    paddingRight: `${aiResponseHPad}px`,
    textAlign: aiResponseAlign as React.CSSProperties["textAlign"],
  };

  const [activeTab, setActiveTab] = useState<TabId>("current");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentContent, isStreaming]);

  // Switch to "current" tab when a new stream starts
  useEffect(() => {
    if (isStreaming) {
      setActiveTab("current");
    }
  }, [isStreaming]);

  const handleCopy = useCallback(
    async (content: string, id: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        // Clipboard access may fail in some contexts
      }
    },
    []
  );

  const handlePin = useCallback(
    (id: string) => {
      const isPinned = pinnedResponses.some((r) => r.id === id);
      if (isPinned) {
        unpinResponse(id);
      } else {
        pinResponse(id);
      }
    },
    [pinnedResponses, pinResponse, unpinResponse]
  );

  // Build tab list: Current + previous history + pinned
  const previousResponses = responseHistory.slice(0, 4);
  const hasTabs =
    previousResponses.length > 0 || pinnedResponses.length > 0;

  // Error state
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="text-xs text-destructive/70">{chineseAssistantError(error)}</p>
        <button className="text-xs text-primary" onClick={() => useMeetingStore.getState().setCurrentView("settings")}>打开设置检查服务</button>
        <details className="max-w-full text-xs text-muted-foreground"><summary>查看错误详情</summary><p className="break-words" data-no-ui-translate>{error}</p></details>
      </div>
    );
  }

  // Determine what content to show based on active tab
  let displayContent: string | null = null;
  let displayResponse: AIResponse | null = null;

  if (activeTab === "current") {
    displayContent = currentContent || null;
  } else if (activeTab.startsWith("history-")) {
    const idx = parseInt(activeTab.replace("history-", ""), 10);
    displayResponse = previousResponses[idx] || null;
    displayContent = displayResponse?.content || null;
  } else if (activeTab.startsWith("pinned-")) {
    const pinnedId = activeTab.replace("pinned-", "");
    displayResponse = pinnedResponses.find((r) => r.id === pinnedId) || null;
    displayContent = displayResponse?.content || null;
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {isRequesting && !isStreaming && <p className="shrink-0 py-1 text-xs text-primary" role="status">正在准备回复并检查知识库…</p>}
      {/* Tabs row */}
      {hasTabs && (
        <div className="mb-2 flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1.5" role="tablist" aria-label="AI 回复标签页">
          <TabButton
            label="当前"
            active={activeTab === "current"}
            onClick={() => setActiveTab("current")}
          />
          {previousResponses.map((resp, idx) => (
            <TabButton
              key={resp.id}
              label={getModeLabel(resp.mode)}
              active={activeTab === `history-${idx}`}
              onClick={() => setActiveTab(`history-${idx}`)}
              secondary
            />
          ))}
          {pinnedResponses.map((resp) => (
            <TabButton
              key={resp.id}
              label={`${getModeLabel(resp.mode)}`}
              active={activeTab === `pinned-${resp.id}`}
              onClick={() => setActiveTab(`pinned-${resp.id}`)}
              pinned
            />
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="relative flex-1 min-h-0">
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto" role="tabpanel" aria-label="AI 回复内容">
        {/* Active streaming state */}
        {activeTab === "current" && isStreaming && (
          <div className="space-y-2.5" aria-live="polite" aria-atomic="false">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-primary/50" />
              <span className="text-meta font-medium text-primary">
                {currentMode ? getModeLabel(currentMode) : "正在生成"}…
              </span>
            </div>
            {currentQuestion && <p className="line-clamp-2 rounded bg-info/10 px-2 py-1 text-xs text-info" data-no-ui-translate>本次回答的问题：{currentQuestion}</p>}
            <BilingualResponseContent key={currentId} content={currentContent} isStreaming proseStyle={proseStyle} />
            <KnowledgeEvidence evidence={currentEvidence} />
          </div>
        )}

        {/* Finished current content (not streaming) */}
        {activeTab === "current" && !isStreaming && currentContent && (
          <div className="space-y-2.5">
            {currentMode && (
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-meta font-medium text-primary/80">
                  {getModeLabel(currentMode)}
                </span>
                <div className="flex items-center gap-1">
                  <ActionButton
                    icon={copiedId === "current" ? Check : Copy}
                    title="复制到剪贴板"
                    onClick={() => handleCopy(currentContent, "current")}
                    active={copiedId === "current"}
                  />
                  {responseHistory.length > 0 && responseHistory[0] && (
                    <ActionButton
                      icon={
                        pinnedResponses.some(
                          (r) => r.id === responseHistory[0].id
                        )
                          ? PinOff
                          : Pin
                      }
                      title={
                        pinnedResponses.some(
                          (r) => r.id === responseHistory[0].id
                        )
                          ? "取消固定"
                          : "固定回复"
                      }
                      onClick={() => handlePin(responseHistory[0].id)}
                    />
                  )}
                </div>
              </div>
            )}
            {currentQuestion && <p className="line-clamp-2 rounded bg-info/10 px-2 py-1 text-xs text-info" data-no-ui-translate>本次回答的问题：{currentQuestion}</p>}
            <BilingualResponseContent
              key={currentId}
              content={currentContent}
              proseStyle={proseStyle}
            />
            <KnowledgeEvidence evidence={currentEvidence} />
            <SourcesList sources={currentSources} />
          </div>
        )}

        {/* History / pinned tab content */}
        {activeTab !== "current" && displayContent && displayResponse && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-meta font-medium text-primary/80">
                {getModeLabel(displayResponse.mode)}
              </span>
              <div className="flex items-center gap-1">
                <ActionButton
                  icon={copiedId === displayResponse.id ? Check : Copy}
                  title="复制到剪贴板"
                  onClick={() =>
                    handleCopy(displayContent!, displayResponse!.id)
                  }
                  active={copiedId === displayResponse.id}
                />
                <ActionButton
                  icon={
                    pinnedResponses.some((r) => r.id === displayResponse!.id)
                      ? PinOff
                      : Pin
                  }
                  title={
                    pinnedResponses.some((r) => r.id === displayResponse!.id)
                      ? "取消固定"
                      : "固定回复"
                  }
                  onClick={() => handlePin(displayResponse!.id)}
                />
              </div>
            </div>
            {displayResponse.question && <p className="line-clamp-2 rounded bg-info/10 px-2 py-1 text-xs text-info" data-no-ui-translate>本次回答的问题：{displayResponse.question}</p>}
            <BilingualResponseContent
              key={displayResponse.id}
              content={displayContent}
              proseStyle={proseStyle}
            />
            <KnowledgeEvidence evidence={displayResponse.evidence} />
            <SourcesList sources={displayResponse.sources} />
          </div>
        )}

        {/* Empty state */}
        {activeTab === "current" && !isStreaming && !currentContent && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary/30" />
            <p className="text-xs text-muted-foreground/50">
              按 <kbd className="mx-0.5 rounded border border-border/30 bg-secondary/30 px-1.5 py-0.5 font-mono text-meta text-foreground/70">空格键</kbd> 获取 AI 协助
            </p>
          </div>
        )}
      </div>
      </div>

      {/* Typeset controls */}
      <details className="shrink-0 border-t border-border/10 px-1 pt-1.5">
        <summary className="cursor-pointer text-[10px] text-muted-foreground/60">文字显示设置</summary>
        <div className="flex flex-col gap-1">
        {/* Row 1: font size + color */}
        <div className="flex items-center gap-3">
          <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground/40 font-medium">AI 文本</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setAiResponseFontSize(Math.max(8, aiResponseFontSize - 1))} className="h-5 w-5 flex items-center justify-center rounded text-[0.6rem] text-muted-foreground/50 hover:bg-accent/40 hover:text-foreground/70 transition-colors" title="缩小字号">A</button>
            <span className="text-[0.6rem] tabular-nums text-muted-foreground/50 w-6 text-center">{aiResponseFontSize}</span>
            <button onClick={() => setAiResponseFontSize(Math.min(32, aiResponseFontSize + 1))} className="h-5 w-5 flex items-center justify-center rounded text-[0.75rem] font-medium text-muted-foreground/50 hover:bg-accent/40 hover:text-foreground/70 transition-colors" title="放大字号">A</button>
          </div>
          <ColorPickerButton value={aiResponseTextColor} onChange={setAiResponseTextColor} label="AI 文本颜色" />
        </div>
        {/* Row 2: line height + horizontal padding + text align */}
        <div className="flex items-center gap-3">
          {/* Line height */}
          <div className="flex items-center gap-1">
            <span className="text-[0.6rem] text-muted-foreground/40">行距</span>
            <button onClick={() => setAiResponseLineHeight(Math.max(1.0, parseFloat((aiResponseLineHeight - 0.1).toFixed(1))))} className="h-5 w-5 flex items-center justify-center rounded text-[0.65rem] text-muted-foreground/50 hover:bg-accent/40 hover:text-foreground/70 transition-colors" title="减小行距">−</button>
            <span className="text-[0.6rem] tabular-nums text-muted-foreground/50 w-6 text-center">{aiResponseLineHeight.toFixed(1)}</span>
            <button onClick={() => setAiResponseLineHeight(Math.min(3.0, parseFloat((aiResponseLineHeight + 0.1).toFixed(1))))} className="h-5 w-5 flex items-center justify-center rounded text-[0.65rem] text-muted-foreground/50 hover:bg-accent/40 hover:text-foreground/70 transition-colors" title="增大行距">+</button>
          </div>
          {/* Horizontal padding */}
          <div className="flex items-center gap-1">
            <span className="text-[0.6rem] text-muted-foreground/40">↔</span>
            <button onClick={() => setAiResponseHPad(Math.max(0, aiResponseHPad - 4))} className="h-5 w-5 flex items-center justify-center rounded text-[0.65rem] text-muted-foreground/50 hover:bg-accent/40 hover:text-foreground/70 transition-colors" title="减小边距">−</button>
            <span className="text-[0.6rem] tabular-nums text-muted-foreground/50 w-6 text-center">{aiResponseHPad}</span>
            <button onClick={() => setAiResponseHPad(Math.min(80, aiResponseHPad + 4))} className="h-5 w-5 flex items-center justify-center rounded text-[0.65rem] text-muted-foreground/50 hover:bg-accent/40 hover:text-foreground/70 transition-colors" title="增大边距">+</button>
          </div>
          {/* Text align */}
          <div className="flex items-center gap-0.5 rounded border border-border/20 overflow-hidden">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAiResponseAlign(a)}
                className={`px-1.5 py-0.5 text-[0.6rem] font-medium transition-colors ${aiResponseAlign === a ? "bg-primary/20 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground/70"}`}
                title={a === "left" ? "左对齐" : a === "center" ? "居中" : "右对齐"}
              >
                {a === "left" ? "L" : a === "center" ? "C" : "R"}
              </button>
            ))}
          </div>
        </div>
        </div>
      </details>
    </div>
  );
}

// --- Sub-components ---

function SourcesList({ sources }: { sources?: StreamSource[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border/10 pt-2">
      <Globe className="h-3 w-3 shrink-0 text-muted-foreground/40" aria-hidden="true" />
      {sources.map((source, idx) => (
        <a
          key={`${source.url}-${idx}`}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          title={source.url}
          className="max-w-[14rem] truncate rounded-full bg-accent/30 px-2 py-0.5 text-meta text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground/80 transition-colors"
        >
          {source.title}
        </a>
      ))}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
  secondary,
  pinned,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  secondary?: boolean;
  pinned?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-meta font-medium transition-colors duration-150 ${
        active
          ? "bg-primary/20 text-primary"
          : secondary
            ? "text-muted-foreground/70 hover:bg-muted/30 hover:text-muted-foreground"
            : pinned
              ? "text-warning/70 hover:bg-warning/10 hover:text-warning"
              : "text-muted-foreground/70 hover:bg-muted/30 hover:text-muted-foreground"
      }`}
    >
      {pinned && <Pin className="mr-0.5 inline-block h-2.5 w-2.5" aria-hidden="true" />}
      {label}
    </button>
  );
}

function ActionButton({
  icon: Icon,
  title,
  onClick,
  active,
}: {
  icon: typeof Copy;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg p-1.5 transition-colors duration-150 ${
        active
          ? "text-success"
          : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent"
      }`}
      aria-label={title}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
