// Test-only entry point. No real credentials, network services, or audio.
import React from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import "../src/index.css";
const stats = { deletedKeys: 0, sttTests: 0, generations: 0, translations: 0, failSave: false };
mockWindows("launcher", "overlay");
mockIPC(async (command) => {
  if (command === "has_api_key") return true;
  if (command === "get_api_key") return "synthetic-fixture-not-a-real-key";
  if (command === "delete_api_key") { stats.deletedKeys++; return; }
  if (command === "test_stt_connection") { stats.sttTests++; throw "Synthetic network failure"; }
  if (command === "test_llm_generation") { stats.generations++; return "OK"; }
  if (command === "translate_text") { stats.translations++; return { translated_text: "模拟翻译" }; }
  if (command === "update_rag_config" && stats.failSave) throw "Synthetic disk failure";
  if (command === "get_rag_status") return JSON.stringify({ total_chunks: 1, indexed_files: 1, total_files: 1, total_tokens: 3, index_stale: true });
  if (["list_local_stt_engines", "get_llm_providers", "list_models", "get_stt_providers"].includes(command)) return "[]";
  if (command === "plugin:store|load") return 1;
  if (command === "plugin:store|get") return [null, false];
  return null;
}, { shouldMockEvents: true });
const { useConfigStore } = await import("../src/stores/configStore");
const { useRagStore } = await import("../src/stores/ragStore");
const { useRagEvents } = await import("../src/hooks/useRagEvents");
const { translateAssistantText } = await import("../src/lib/assistantTranslation");
const { installChineseUi } = await import("../src/lib/chineseUi");
installChineseUi();
useConfigStore.setState({ llmProvider: "openai", llmModel: "test-model-one", sttProvider: "whisper_api", verifiedCloudProviders: [] });
(window as any).__settingsTest = { stats, rag: useRagStore, config: useConfigStore, translate: translateAssistantText, emit };
const kind = new URLSearchParams(location.search).get("kind");
const { LLMSettings } = await import("../src/settings/LLMSettings");
const { STTSettings } = await import("../src/settings/STTSettings");
function SettingsPreview() {
  useRagEvents();
  return <div className="p-4">{kind === "stt" ? <STTSettings /> : <LLMSettings />}</div>;
}
createRoot(document.getElementById("root")!).render(<SettingsPreview />);
