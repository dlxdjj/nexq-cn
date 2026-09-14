import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslationStore } from "../stores/translationStore";
import { translationSegments } from "../lib/meetingAssistant";
import { translateAssistantText } from "../lib/assistantTranslation";

export function BilingualResponseContent({ content, isStreaming = false, proseStyle }: {
  content: string;
  isStreaming?: boolean;
  proseStyle: React.CSSProperties;
}) {
  const target = useTranslationStore((s) => s.targetLang || "zh");
  const source = useTranslationStore((s) => s.sourceLang);
  const provider = useTranslationStore((s) => s.provider);
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [retry, setRetry] = useState(0);
  const pieces = translationSegments(content, !isStreaming);
  const signature = JSON.stringify([provider, source, target, pieces]);

  useEffect(() => {
    let cancelled = false;
    const [selectedProvider, selectedSource, selectedTarget, sentences] = JSON.parse(signature) as [string, string, string, string[]];
    for (const sentence of sentences) {
      const key = JSON.stringify([selectedProvider, selectedSource, selectedTarget, sentence]);
      translateAssistantText(sentence, selectedTarget, selectedSource, selectedProvider).then((result) => {
        if (!cancelled) setTranslated((previous) => ({ ...previous, [key]: result }));
      }).catch(() => {
        if (!cancelled) setFailed((previous) => new Set(previous).add(key));
      });
    }
    return () => { cancelled = true; };
  }, [signature, retry]);

  const keys = pieces.map((piece) => JSON.stringify([provider, source, target, piece]));
  const hasFailure = keys.some((key) => !translated[key] && failed.has(key));
  const pending = keys.some((key) => !translated[key] && !failed.has(key));

  return (
    <div className="space-y-3" data-no-ui-translate>
      <section className="space-y-1">
        <p className="text-[10px] font-semibold tracking-wider text-sky-400/80">推荐英文回复</p>
        <div className="prose prose-sm prose-invert max-w-none break-words" style={proseStyle}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          {isStreaming && <span className="inline-block h-3 w-0.5 animate-pulse bg-primary/60" />}
        </div>
      </section>
      <section className="space-y-1 border-t border-emerald-400/20 pt-2.5" aria-label="回复译文">
        <p className="text-[10px] font-semibold tracking-wider text-emerald-400/80">
          {target.startsWith("zh") ? "回复中文翻译" : `回复译文（${target}）`}
        </p>
        {keys.map((key, index) => translated[key] ? (
          <div key={`${key}-${index}`} className="prose prose-sm prose-invert max-w-none break-words" style={proseStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{translated[key]}</ReactMarkdown>
          </div>
        ) : <p key={`${key}-${index}`} className="text-xs text-muted-foreground/60">{failed.has(key) ? "此句翻译失败" : "此句正在翻译…"}</p>)}
        {(pending || (isStreaming && pieces.length === 0)) && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground/60"><Loader2 className="h-3 w-3 animate-spin" />中文逐句更新，不必等待英文全部生成</p>
        )}
        {hasFailure && <button type="button" className="text-xs text-warning" onClick={() => { setFailed(new Set()); setRetry((value) => value + 1); }}>部分翻译失败，点击重试（已完成的译文保留）</button>}
      </section>
    </div>
  );
}
