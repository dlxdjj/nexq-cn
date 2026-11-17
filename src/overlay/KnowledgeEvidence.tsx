import type { KnowledgeEvidenceInfo, WebSearchStatus } from "../lib/types";

const labels: Record<string, string> = {
  disabled: "本次操作未启用知识库检索",
  no_index: "尚无可检索资料，请先上传文件并建立索引",
  not_searched: "没有有效查询，本次未检索知识库",
  no_match: "未找到达到阈值的资料，请勿将建议视为已核实事实",
  error: "知识库检索失败，本次回复缺少知识库依据",
  partial: "部分检索失败，仅展示成功检索到的片段",
  cached: "使用服务端缓存资料，暂无本地片段来源可展示",
  matched: "已检索到参考片段（不代表答案已核实）",
};

const webSearchLabels: Record<WebSearchStatus, string> = {
  matched: "已找到网页资料，可查看下方来源",
  no_results: "未找到可用的网页资料",
  timeout: "搜索超时，继续使用已有上下文",
  error: "搜索失败，继续使用已有上下文",
  not_configured: "请在「设置 → AI 操作」中配置 Tavily 密钥",
  no_query: "本次没有可搜索的问题",
  native: "由当前回答模型按需搜索",
};

export function KnowledgeEvidence({ evidence }: { evidence?: KnowledgeEvidenceInfo }) {
  if (!evidence) return null;
  return (
    <div className="rounded-lg border border-border/30 bg-background/30 p-2 text-xs" data-no-ui-translate>
      <p className={evidence.status === "matched" ? "text-emerald-400" : "text-warning"}>知识库：{labels[evidence.status] || "状态未知，请核对资料"}</p>
      {evidence.webSearchStatus && (
        <p className={evidence.webSearchStatus === "matched" ? "text-emerald-400" : "text-muted-foreground"}>
          联网搜索 · {webSearchLabels[evidence.webSearchStatus]}
        </p>
      )}
      {evidence.chunks.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-muted-foreground">查看 {evidence.chunks.length} 个实际检索片段与文件来源</summary>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {evidence.chunks.map((chunk, index) => (
              <div key={index} className="border-l-2 border-primary/30 pl-2">
                <p className="break-words font-medium">[Source {index + 1}] {chunk.source} · 片段 {chunk.chunk_index + 1}</p>
                <p className="whitespace-pre-wrap break-words text-muted-foreground">{chunk.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
