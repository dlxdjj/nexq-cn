/** Stable, completed sentences only while streaming; include the tail on completion. */
export function translationSegments(text: string, complete: boolean): string[] {
  const segments: string[] = [];
  const boundaries = /[.!?。！？]["')\]]*(?:\s+|$)|\n+/gu;
  let start = 0;
  for (const match of text.matchAll(boundaries)) {
    const end = match.index! + match[0].length;
    if (!complete && end === text.length && !/\s$/.test(match[0])) break;
    const candidate = text.slice(start, end).trim();
    // Avoid splitting common English abbreviations or an unfinished numbered list.
    if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e)\.$/i.test(candidate) || /^\d+\.$/.test(candidate)) continue;
    if (candidate) segments.push(candidate);
    start = end;
  }
  if (complete && text.slice(start).trim()) segments.push(text.slice(start).trim());
  return segments;
}

/** Channel identity is authoritative online; diarization IDs are not identities. */
export function onlineSpeakerId(speaker: string, segmentId = ""): "you" | "them" {
  if (/^(user|you|me)$/i.test(speaker) || segmentId.startsWith("you_")) return "you";
  return "them";
}

export function hasSpeechText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

export function looksLikeMeetingQuestion(text: string): boolean {
  if (!hasSpeechText(text)) return false;
  const normalized = text.trim().toLowerCase();
  return /[?？]/.test(normalized) || /^(what|how|why|when|where|who|which)\b/.test(normalized)
    || /^(can|could|would|will|do|does|did|are|is|have|has)\s+(you|we|your|there|it|the)\b/.test(normalized)
    || /^(please\s+)?(tell me|tell us|explain|describe|walk us through|walk me through)\b/.test(normalized);
}

export function chineseAssistantError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/already in progress/i.test(message)) return "已有回复正在生成，请等待完成后重试。";
  if (/no (active |available )?(llm )?provider|no providers|router not initialized/i.test(message)) return "尚未连接回答模型，请在设置中配置 AI 服务并测试连接。";
  if (/no active model|model.*not found|model.*required/i.test(message)) return "尚未选择可用模型，请在设置中选择或下载模型。";
  if (/401|403|api.?key|unauthorized|authentication/i.test(message)) return "服务认证失败，请检查 API 密钥及服务权限。";
  if (/429|rate.limit|quota/i.test(message)) return "服务额度或请求频率受限，请稍后重试并检查额度。";
  if (/timeout|timed out/i.test(message)) return "服务响应超时，请检查连接后重试。";
  if (/cancel/i.test(message)) return "本次生成已取消，可重新生成。";
  if (/connect|network|fetch|error sending request/i.test(message)) return "无法连接服务，请检查网络或本地模型是否已启动。";
  return "处理失败，请重试；详细原因可在 AI 日志中查看。";
}

/** Bounded success cache, in-flight deduplication, and a small shared request queue. */
export function createTranslationQueue(
  translate: (text: string, target: string, source: string) => Promise<string>,
  concurrency = 2,
  cacheLimit = 200,
) {
  const cache = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();
  const jobs: Array<() => void> = [];
  let active = 0;
  const pump = () => {
    while (active < concurrency && jobs.length) jobs.shift()!();
  };
  return (text: string, target: string, source: string, provider: string): Promise<string> => {
    const key = JSON.stringify([provider, source, target, text]);
    if (cache.has(key)) return Promise.resolve(cache.get(key)!);
    if (pending.has(key)) return pending.get(key)!;
    const promise = new Promise<string>((resolve, reject) => {
      jobs.push(() => {
        active++;
        Promise.resolve().then(() => translate(text, target, source)).then((result) => {
          if (!result.trim()) throw new Error("Empty translation");
          cache.set(key, result);
          while (cache.size > cacheLimit) cache.delete(cache.keys().next().value!);
          resolve(result);
        }).catch(reject).finally(() => {
          active--;
          pending.delete(key);
          pump();
        });
      });
    });
    pending.set(key, promise);
    pump();
    return promise;
  };
}
