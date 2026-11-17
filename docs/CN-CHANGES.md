# 中文定制改动索引

基线：`naxhq/NexQ@1ce1524c122df509f231c521a07ada95bfde2d88`。应用版本为 `2.20.14-cn.5`。

cn5 增加 Tavily 网页搜索、结果来源与搜索状态展示，扩展英文面试请求识别，并在 Windows 安装包中包含 DirectML.dll。搜索设置位于「AI 操作」，密钥使用既有 Windows 凭据管理器。

此清单汇总本次定制的累积改动，并非上游已有能力清单；`CHANGELOG.md` 和 `README.upstream.md` 保留的是上游历史资料。cn1–cn3 的中间改动未逐次形成 Git 提交，不伪造逐版提交历史。

| 改动主题 | 主要实现文件 |
| --- | --- |
| 中文界面、品牌、独立应用标识 | `src/lib/chineseUi.ts`、`src/lib/version.ts`、`src/main.tsx`、`src-tauri/tauri.conf.json`、`src-tauri/src/tray/*` |
| 问题检测、自动回复与问题绑定 | `src/lib/meetingAssistant.ts`、`src/hooks/useAutomaticAssist.ts`、`src/overlay/QuestionDetector.tsx`、`src/overlay/AIResponsePanel.tsx` |
| 双语回复及增量翻译 | `src/overlay/BilingualResponseContent.tsx`、`src/lib/assistantTranslation.ts`、`src/hooks/useTranslation.ts`、`src/stores/translationStore.ts` |
| 固定我方/对方、长话轮字幕 | `src/hooks/useTranscript.ts`、`src/stores/speakerStore.ts`、`src/overlay/TranscriptLine.tsx`、`src-tauri/src/stt/segment_accumulator.rs` |
| 静音门控、音频重叠、完整话轮、背压 | `src-tauri/src/stt/speech_turn.rs`、`src-tauri/src/stt/whisper_api.rs` |
| 第一人称口语提示词及旧默认迁移 | `src/lib/spokenReplyPrompt.txt`、`src/lib/promptTemplates.ts`、`src/stores/aiActionsStore.ts`、`src-tauri/src/intelligence/prompt_templates.rs`、`src-tauri/src/commands/intelligence_commands.rs` |
| 回复与翻译输出隔离、取消和并发 | `src-tauri/src/llm/output.rs`、`src-tauri/src/llm/provider.rs` 及各 provider、`src-tauri/src/intelligence/generation_guard.rs`、`src-tauri/src/commands/translation_commands.rs` |
| RAG 持久化、索引事务和匹配阈值 | `src-tauri/src/rag/settings.rs`、`src-tauri/src/rag/search.rs`、`src-tauri/src/rag/fts_store.rs`、`src-tauri/src/commands/rag_commands.rs`、`src-tauri/src/db/rag.rs` |
| 知识库依据展示 | `src/overlay/KnowledgeEvidence.tsx`、`src/hooks/useRagEvents.ts`、`src/stores/ragStore.ts` |
| 设置中的真实服务测试 | `src/settings/LLMSettings.tsx`、`src/settings/STTSettings.tsx`、`src/settings/ContextStrategySettings.tsx`、对应 Rust commands、`src-tauri/fixtures/` |
| 主窗口/悬浮窗和快捷键职责 | `src/hooks/useMeetingWindowControl.ts`、`src/lib/meetingControl.ts`、`src/hooks/useGlobalShortcut.ts`、`src/App.tsx` |
| 定制版配置、凭据与更新隔离 | `src-tauri/src/credentials/windows_cred.rs`、`src-tauri/src/context/mod.rs`、`src/hooks/useUpdater.ts`、`src-tauri/tauri.conf.json` |
| 回归测试和发布整理 | `tests/`、Rust 模块内单元测试、`scripts/build-cn.ps1`、`.gitignore`、禁用的上游发布工作流 |

## cn4 重点回归场景

1. 两分钟合成数字静音、低噪声、直流偏移与短点击不产生有效语音话轮。
2. 两个通道即使上报相同发言者 ID，也显示为我方/对方。
3. 连续长问题更新同一条字幕，讲话期间先翻译，完整提交后只生成一次回复。
4. 对方长话轮期间我方简短回应，不误取消随后提交的完整问题。
5. 后续非问题不会重新触发旧问题；真实感谢用语保留。
6. 翻译/连接测试不向会议回答广播事件；取消与失败不锁死生成槽位。
7. 旧默认提示词迁移，自定义指令保留；弱相关向量不被放大为完美匹配。
8. 索引构建或发布失败保留旧资料索引，设置更改提示索引失配。

测试样本与模拟 UI 只能覆盖特定逻辑；不能替代真实 Teams 音频、个人知识库召回或事实准确率评估。查看 [测试运行方式](../tests/README.md)。
