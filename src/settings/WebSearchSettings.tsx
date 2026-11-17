import { useEffect, useState } from "react";
import { deleteApiKey, hasApiKey, storeApiKey, testWebSearch } from "../lib/ipc";
import { useAIActionsStore } from "../stores/aiActionsStore";

const PROVIDER = "tavily";
const buttonClass = "rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

export function WebSearchSettings() {
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; error: boolean }>();
  const assistSearch = useAIActionsStore((state) => state.configs.actions.Assist?.webSearch ?? false);
  const updateAction = useAIActionsStore((state) => state.updateActionConfig);

  useEffect(() => {
    let active = true;
    hasApiKey(PROVIDER).then((saved) => {
      if (active) setHasKey(saved);
    }).catch(() => {
      if (active) {
        setHasKey(false);
        setStatus({ message: "读取搜索密钥状态失败。", error: true });
      }
    });
    return () => { active = false; };
  }, []);

  async function run(operation: () => Promise<void>, success: string) {
    setBusy(true);
    setStatus(undefined);
    try {
      await operation();
      setStatus({ message: success, error: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function saveKey() {
    const key = apiKey.trim();
    if (!key) return;
    await run(async () => {
      await storeApiKey(PROVIDER, key);
      setHasKey(true);
      setApiKey("");
    }, "Tavily 密钥已保存。");
  }

  async function clearKey() {
    await run(async () => {
      await deleteApiKey(PROVIDER);
      setHasKey(false);
      setApiKey("");
    }, "已清除 Tavily 密钥。");
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/30 bg-card/50 p-4" aria-labelledby="web-search-title">
      <div>
        <h3 id="web-search-title" className="text-sm font-semibold text-primary/80">联网搜索</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          配置 Tavily 后，OpenAI 等回答模型也能参考网页资料。只把当前问题发送给搜索服务。
        </p>
      </div>
      <label className="block text-xs font-medium" htmlFor="tavily-key">Tavily API Key</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="tavily-key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={hasKey ? "已保存，输入新密钥以替换" : "输入 Tavily API Key"}
          disabled={busy || hasKey === null}
          className="min-w-48 flex-1 rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs"
        />
        <button type="button" className={buttonClass} disabled={busy || hasKey === null || !apiKey.trim()} onClick={saveKey}>
          保存
        </button>
        <button type="button" className={buttonClass} disabled={busy || !hasKey} onClick={() => run(testWebSearch, "搜索服务连接成功。")}>
          测试搜索
        </button>
        {hasKey && <button type="button" className={buttonClass} disabled={busy} onClick={clearKey}>清除密钥</button>}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={assistSearch}
          onChange={(event) => updateAction("Assist", { webSearch: event.target.checked })}
          className="h-3.5 w-3.5 accent-primary"
        />
        为「生成回复」启用联网搜索
      </label>
      {status && <p role="status" className={status.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{status.message}</p>}
    </section>
  );
}
