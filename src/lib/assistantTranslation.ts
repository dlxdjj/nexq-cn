import { translateText } from "./ipc";
import { createTranslationQueue } from "./meetingAssistant";
import { useConfigStore } from "../stores/configStore";

const queue = createTranslationQueue(async (text, target, source) => {
  const result = await translateText(text, target, source === "auto" ? "en" : source);
  return result.translated_text;
});

export function translateAssistantText(text: string, target: string, source: string, provider: string) {
  const config = useConfigStore.getState();
  const scope = provider === "llm" ? `${provider}:${config.llmProvider}:${config.llmModel}` : provider;
  return queue(text, target, source, scope);
}
