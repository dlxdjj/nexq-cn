/**
 * Simplified-Chinese UI layer for the NexQ CN distribution.
 *
 * NexQ currently has user-facing strings embedded throughout the React tree.
 * This distribution keeps upstream components easy to merge by translating
 * UI-only DOM text and accessibility attributes at the application boundary.
 * Transcript, AI, prompt, and document content can opt out with
 * `data-no-ui-translate` so meeting content is never rewritten.
 */

const EXACT_TRANSLATIONS: Record<string, string> = {
  "Starred": "已收藏",
  "Online": "线上会议",
  "Start a meeting to see it here": "开始会议后，记录将显示在这里",
  "Drag files here": "将知识库文件拖到这里",
  "Browse Files": "选择文件",
  "PDF, TXT, Markdown, or DOCX": "支持 PDF、TXT、Markdown 或 DOCX",
  "NexQ": "NexQ 中文助手",
  "NexQ Dev Log": "NexQ 开发日志",
  "NexQ Overlay": "NexQ 实时助手",
  "Settings": "设置",
  "General": "常规",
  "Meeting": "会议",
  "Providers": "服务提供商",
  "Intelligence": "智能助手",
  "System": "系统",
  "Developer": "开发者",
  "About": "关于",
  "Back": "返回",
  "Go back": "返回",
  "Close": "关闭",
  "Cancel": "取消",
  "Save": "保存",
  "Edit": "编辑",
  "Delete": "删除",
  "Delete?": "确认删除？",
  "Clear": "清除",
  "Clear all": "全部清除",
  "Reset": "重置",
  "Activate": "启用",
  "Active": "已启用",
  "active": "已启用",
  "All": "全部",
  "None": "无",
  "New": "新建",
  "Newest first": "最新优先",
  "Free": "免费",
  "Cloud": "云端",
  "Local": "本地",
  "Connected": "已连接",
  "Disconnected": "未连接",
  "Connection": "连接",
  "Error": "错误",
  "Loading...": "正在加载…",
  "loading...": "正在加载…",
  "Starting NexQ...": "正在启动 NexQ…",
  "Language": "语言",
  "Theme": "主题",
  "Features": "功能",
  "License": "许可证",
  "Build Date": "构建日期",
  "Architecture": "系统架构",

  "Start Meeting": "开始会议",
  "New Meeting": "新建会议",
  "Meeting in Progress": "会议进行中",
  "Meeting Context": "会议上下文",
  "Meeting Setup": "会议设置",
  "Recent Meetings": "最近会议",
  "No recent meetings": "暂无最近会议",
  "No meetings yet": "暂无会议记录",
  "Search meetings...": "搜索会议…",
  "Delete All Meetings": "删除全部会议",
  "Run Setup Wizard": "运行设置向导",
  "Meeting Audio": "会议音频",
  "Record Audio": "录制音频",
  "Record to file": "录制到文件",
  "Save meeting audio as WAV": "将会议音频保存为 WAV",
  "Meeting in progress conflict": "已有会议正在进行",
  "Meeting in progress": "会议正在进行",
  "End meeting": "结束会议",
  "Back to launcher": "返回主界面",
  "Back to Launcher": "返回主界面",
  "Start a meeting to see the transcript": "开始会议后即可查看实时转写",
  "Meeting started": "会议已开始",
  "Meeting ended": "会议已结束",
  "Meeting deleted": "会议已删除",
  "All meetings deleted": "所有会议已删除",

  "Transcript": "实时转写",
  "Text": "文本",
  "Timestamp": "时间戳",
  "Speaker": "发言人",
  "Speakers": "发言人",
  "Words": "字词数",
  "Pace": "语速",
  "Duration": "时长",
  "Avg": "平均",
  "You": "我方",
  "You:": "我方：",
  "Them": "对方",
  "Them:": "对方：",
  "Mic": "麦克风",
  "Microphone": "麦克风",
  "Room": "会场",
  "System Audio": "系统声音",
  "System Audio (Output)": "系统声音（输出设备）",
  "Audio Devices": "音频设备",
  "Audio Setup": "音频设置",
  "Audio Sessions": "音频会话",
  "Audio source & recognition": "音频来源与语音识别",
  "Capturing audio": "正在采集音频",
  "Microphones": "麦克风设备",
  "Speakers / Output": "扬声器／输出设备",
  "Noise Environment": "噪声环境",
  "Live Monitor": "实时监听",
  "Device override active.": "已启用设备覆盖设置。",
  "Your microphone — used in online meetings": "你的麦克风——用于在线会议",
  "Remote party (online) or room microphone (in-person)": "远程参会者（在线）或会场麦克风（线下）",
  "online meetings": "在线会议",
  "in-person meetings": "线下会议",
  "During meetings:": "会议期间：",
  "Dual-purpose audio:": "双用途音频：",
  "Use headphones to prevent echo": "请使用耳机以避免回声",

  "Speech-to-Text": "语音转文字",
  "STT Configuration": "语音识别配置",
  "STT language": "语音识别语言",
  "Provider": "服务提供商",
  "Model": "模型",
  "Model:": "模型：",
  "Choose a model...": "选择模型…",
  "Select a model...": "选择模型…",
  "Loading providers...": "正在加载服务提供商…",
  "Local & Built-in": "本地及系统内置",
  "Local & Offline": "本地离线",
  "Cloud Providers": "云服务提供商",
  "Requires API Key": "需要 API 密钥",
  "Free · No API Key": "免费 · 无需 API 密钥",
  "API Key": "API 密钥",
  "API Key Header": "API 密钥请求头",
  "Azure Region": "Azure 区域",
  "Base URL": "服务地址",
  "Auth Type": "认证方式",
  "Bearer Token": "Bearer 令牌",
  "Custom Provider": "自定义服务提供商",
  "Test Connection": "测试连接",
  "Testing connection...": "正在测试连接…",
  "Testing...": "正在测试…",
  "Connection successful — provider is ready": "连接成功——服务已就绪",
  "Connection failed": "连接失败",
  "Connection failed — key not saved": "连接失败——密钥未保存",
  "Web Speech": "网页语音识别",
  "Web Speech API": "网页语音识别 API",
  "Windows Speech": "Windows 语音识别",
  "Whisper API": "Whisper API",
  "Whisper.cpp (Local)": "Whisper.cpp（本地）",
  "Groq Whisper": "Groq Whisper",
  "Azure Speech": "Azure 语音服务",
  "Browser-native, free": "浏览器内置，免费",
  "Browser-native, works with microphone input": "浏览器内置，支持麦克风输入",
  "Built-in, zero download": "系统内置，无需下载",
  "Local streaming, offline, free": "本地流式识别，离线免费",
  "Local, GPU-accelerated": "本地运行，支持 GPU 加速",
  "Batch transcription of recorded meetings": "对会议录音进行批量转写",
  "Best accuracy, offline, multilingual": "准确率高，离线且支持多语言",
  "Real-time streaming, best quality": "实时流式识别，质量最佳",
  "Real-time streaming STT, high accuracy": "高准确率实时流式识别",
  "OpenAI Whisper model": "OpenAI Whisper 模型",
  "OpenAI Whisper, excellent multilingual support": "OpenAI Whisper，优秀的多语言支持",
  "Azure Cognitive Services": "Azure 认知服务",
  "Ultra-fast Whisper inference": "超高速 Whisper 推理",
  "OpenAI Whisper running locally — offline, free": "本地运行 OpenAI Whisper——离线免费",
  "Confidence Highlighting": "识别置信度标记",
  "Confidence Threshold": "置信度阈值",
  "Highlight Low Confidence": "标记低置信度内容",
  "Speech will appear as it's detected": "识别到语音后会在这里显示",
  "Interim Results": "显示临时识别结果",
  "Punctuation": "自动标点",
  "Profanity Filter": "敏感词过滤",
  "Numerals": "数字格式化",
  "Smart Format": "智能格式化",
  "VAD Events": "语音活动检测事件",
  "Speaker Diarization": "说话人分离",
  "Diarization": "说话人分离",
  "Keyterm Prompting": "关键词提示",
  "No keyterms — model uses default recognition": "未添加关键词——模型将使用默认识别",
  "Silence threshold": "静音阈值",
  "Endpointing": "语句结束检测",
  "Audio accumulation time": "音频累积时间",
  "Batch Duration": "批处理时长",
  "Batch Size": "批处理大小",
  "Timestamp Granularities": "时间戳粒度",

  "LLM Configuration": "大语言模型配置",
  "LLM model": "大语言模型",
  "Ollama Connected": "Ollama 已连接",
  "Ollama Disconnected": "Ollama 未连接",
  "LLM Translation": "大模型翻译",
  "Uses your active LLM provider": "使用当前启用的大语言模型服务",
  "Anthropic": "Anthropic",
  "OpenAI": "OpenAI",
  "Ultra-fast inference": "超高速推理",
  "Local LLM": "本地大语言模型",
  "Response Format": "回复格式",
  "Response Style": "回复风格",
  "AI Behavior": "AI 行为",
  "AI Actions": "AI 操作",
  "AI Answer": "AI 推荐回复",
  "AI Generated": "AI 生成",
  "AI Text": "AI 文本",
  "AI text color": "AI 文本颜色",
  "AI Call Log": "AI 调用日志",
  "AI Log": "AI 日志",
  "AI": "AI",
  "Calls": "调用",
  "Tools": "工具",
  "Reasoning": "推理过程",
  "Prompt": "提示词",
  "SYSTEM PROMPT": "系统提示词",
  "Current": "当前",
  "Generating": "正在生成",
  "Analyzing transcript...": "正在分析会议内容…",
  "No AI interactions": "暂无 AI 交互",
  "No AI interactions recorded": "尚未记录 AI 交互",
  "Press Space for AI assistance": "按空格键获取 AI 协助",
  "Ask a question": "提出问题",
  "Ask about the meeting...": "询问会议内容…",
  "Send question": "发送问题",
  "Detected Question": "检测到的问题",
  "Detected questions": "检测到的问题",
  "Listening for questions from the other party": "正在监听对方提出的问题",
  "Answered": "已生成回复",
  "Already answered": "已生成回复",
  "Assist": "生成回复",
  "Get AI assistance for this question": "为此问题生成 AI 回复",
  "Dismiss question": "忽略问题",
  "What to Say": "推荐表达",
  "Shorten": "精简",
  "Follow Up": "追问建议",
  "Recap": "会议回顾",
  "Ask": "提问",
  "Tone": "语气",
  "Format": "格式",
  "Length": "长度",
  "Perspective": "表达角度",
  "Additional Instructions": "附加说明",
  "Auto-Trigger": "自动触发",
  "Temperature": "随机性",
  "Transcript Window": "转写上下文范围",
  "Custom Instructions": "自定义说明",
  "Add custom instructions for AI responses...": "添加 AI 回复的自定义说明…",
  "Add extra instructions beyond the presets above...": "在以上预设之外添加说明…",
  "Built-in and custom AI action modes": "内置及自定义 AI 操作模式",
  "Control automation and response characteristics": "控制自动化及回复特征",
  "What data the AI considers when responding": "设置 AI 回复时参考的数据",
  "How the AI formats and phrases its answers": "设置 AI 回复的格式和表达方式",

  "Translation": "实时翻译",
  "Translations": "翻译",
  "Translating...": "正在翻译…",
  "Source Language": "源语言",
  "Target Language": "目标语言",
  "Auto-detect (recommended)": "自动检测（推荐）",
  "All Languages": "所有语言",
  "Behavior": "行为设置",
  "Inline": "原文下方显示",
  "Hover": "鼠标悬停显示",
  "Select-to-translate toolbar": "选中文本时显示翻译工具栏",
  "Cache translations": "缓存翻译结果",
  "Show translations in post-meeting review": "会后查看时显示翻译",
  "Show a translate button when selecting text in the transcript": "在转写中选中文本时显示翻译按钮",
  "Store translated text locally to avoid re-translating the same content": "将译文保存在本地，避免重复翻译",
  "Display translation toolbar and cached translations when reviewing past meetings": "查看历史会议时显示翻译工具栏和缓存译文",
  "Get a free API key": "获取免费 API 密钥",
  "100+ langs · Fully offline · Private": "100 多种语言 · 完全离线 · 隐私安全",
  "Chinese (Simplified)": "简体中文",
  "Chinese (Traditional)": "繁体中文",
  "English": "英语",

  "Context": "知识库",
  "Context Intelligence": "知识库智能检索",
  "Context Window": "上下文窗口",
  "Context: high → low": "上下文：从高到低",
  "Local RAG": "本地知识库检索",
  "Gemini Context Cache": "Gemini 上下文缓存",
  "Files indexed": "已索引文件",
  "Index Status": "索引状态",
  "Indexed": "已索引",
  "Not Indexed": "未索引",
  "Last indexed": "上次索引",
  "Total chunks": "文本块总数",
  "Total tokens": "Token 总数",
  "Token budget usage": "Token 预算使用情况",
  "Token Budget": "Token 预算",
  "Tokens": "Token",
  "Tokens:": "Token：",
  "Tokens cached:": "已缓存 Token：",
  "RAG Chunks": "知识库片段",
  "Search Settings": "检索设置",
  "Search Mode": "检索模式",
  "Hybrid (recommended)": "混合检索（推荐）",
  "Semantic Only": "仅语义检索",
  "Keyword Only (fastest)": "仅关键词（最快）",
  "Smart Search Active": "智能检索已启用",
  "Test Knowledge Base": "测试知识库",
  "Test Search": "测试检索",
  "Searching knowledge base...": "正在检索知识库…",
  "Ask a question about your documents...": "询问已上传文档…",
  "Query:": "查询：",
  "No matches": "没有匹配结果",
  "Add Document": "添加文档",
  "Add Files": "添加文件",
  "Drop files here or click to browse": "将文件拖到此处，或点击选择",
  "Re-index file": "重新索引文件",
  "Rebuild All": "全部重建",
  "Embedding Model": "嵌入模型",
  "Results to Retrieve (top-K)": "检索结果数量（top-K）",
  "Chunk Size (tokens)": "文本块大小（Token）",
  "Chunk Overlap (tokens)": "文本块重叠量（Token）",
  "Similarity Threshold": "相似度阈值",
  "Semantic Weight (Hybrid mode)": "语义权重（混合模式）",
  "Embedding Batch Size": "嵌入批处理大小",
  "Fastest": "最快",
  "Faster": "较快",
  "Default": "默认",
  "Accurate": "准确",
  "Most Accurate": "最准确",
  "Keyword-only search, no embedding needed at query time": "仅关键词检索，查询时无需嵌入模型",
  "Hybrid search with small embedding model": "使用小型嵌入模型进行混合检索",
  "Best balance of speed and accuracy": "速度与准确率的最佳平衡",
  "More results, finer chunks, better coverage": "更多结果、更细文本块和更广覆盖",
  "High-dimensional model, fine chunks, maximum context": "高维模型、精细文本块和最大上下文",

  "Summary": "会议摘要",
  "No summary available": "暂无摘要",
  "No summary yet": "尚未生成摘要",
  "Generate an AI summary from the transcript": "根据转写内容生成 AI 摘要",
  "Generating summary...": "正在生成摘要…",
  "Action Items": "行动项",
  "Actions": "行动项",
  "Extract Action Items": "提取行动项",
  "Extracting action items, assignments, and follow-ups": "正在提取行动项、任务和后续安排",
  "Bookmarks": "书签",
  "No bookmarks yet": "暂无书签",
  "No bookmarks yet. Right-click a line or use Ctrl+B to bookmark.": "暂无书签。右键点击转写内容或按 Ctrl+B 添加书签。",
  "Bookmark Note": "书签备注",
  "No note — click to add": "暂无备注——点击添加",
  "Add note...": "添加备注…",
  "Speaker Timeline": "发言时间线",
  "No speaker data": "暂无发言人数据",
  "No speakers tracked yet.": "尚未记录发言人。",
  "No transcript segments": "暂无转写内容",
  "Export": "导出",
  "Export meeting": "导出会议",
  "Export options": "导出选项",
  "Export transcript": "导出转写",
  "Full transcript + summary": "完整转写和摘要",
  "SRT Subtitles": "SRT 字幕",
  "Timed subtitle file": "带时间轴的字幕文件",
  "Structured data export": "结构化数据导出",

  "Team Meeting": "团队会议",
  "Lecture": "课程／讲座",
  "Interview": "面试",
  "Webinar": "网络研讨会",
  "Oral Exam": "口试",
  "Active Scenario": "当前场景",
  "Custom scenario": "自定义场景",
  "Questions, responses, follow-ups": "问题、回答和追问",
  "Tracks decisions, action items, speaker attribution": "跟踪决策、行动项和发言人",
  "Key concepts, definitions, Q&A extraction": "提取关键概念、定义及问答",
  "Presentation points, audience Q&A": "演示要点及听众问答",
  "Exam prep — professor questions, coached responses, knowledge gaps": "口试准备——考官问题、回答建议和知识薄弱点",

  "Welcome to NexQ": "欢迎使用 NexQ 中文助手",
  "Welcome": "欢迎",
  "Audio": "音频",
  "Ready": "准备就绪",
  "You're all set": "设置完成",
  "Quick Presets": "快速预设",
  "Presets": "预设",
  "Zero Setup": "零配置",
  "Best Quality": "最佳质量",
  "Fully Offline": "完全离线",
  "All Cloud": "全部使用云服务",
  "Local Only (Whisper)": "仅本地（Whisper）",
  "In-Person": "线下会议",
  "Recommended": "推荐",
  "Recommended (Free):": "推荐（免费）：",
  "BEST": "最佳",
  "FAST": "快速",
  "NEW": "新",
  "Tip:": "提示：",
  "Advanced Settings": "高级设置",
  "Overlay Transparency": "悬浮窗透明度",
  "Transparent": "透明",
  "Solid": "不透明",
  "Screenshot only": "仅截图",
  "Notifications": "通知",
  "Start on login": "开机启动",
  "Hotkeys": "快捷键",
  "Reset all hotkeys to defaults": "将所有快捷键恢复默认",
  "Hotkeys reset to defaults": "快捷键已恢复默认",
  "Clear saved preferences": "清除已保存的偏好设置",

  "Copy": "复制",
  "Copy all": "复制全部",
  "Copy section": "复制本节",
  "Copy response": "复制回复",
  "Copy to clipboard": "复制到剪贴板",
  "Copied to clipboard": "已复制到剪贴板",
  "Pin response": "固定回复",
  "Unpin": "取消固定",
  "Play": "播放",
  "Download": "下载",
  "Download recording": "下载录音",
  "Volume": "音量",
  "Search transcript...": "搜索转写…",
  "Search models...": "搜索模型…",
  "Clear search": "清除搜索",
  "No matches found": "未找到匹配内容",
  "Accept suggestion": "采用建议",
  "Dismiss suggestion": "忽略建议",
  "Add Note": "添加备注",
  "Copy Text": "复制文本",
  "Ctrl+Enter to save": "按 Ctrl+Enter 保存",
  "Add a note...": "添加备注…",
  "Smaller": "缩小",
  "Larger": "放大",
  "Decrease line height": "减小行高",
  "Increase line height": "增大行高",
  "Decrease margin": "减小边距",
  "Increase margin": "增大边距",
  "Expand AI panel": "展开 AI 面板",
  "Expand transcript panel": "展开转写面板",
  "Expand transcript": "展开转写",
  "Minimize to Dashboard": "最小化到主界面",
  "Open settings": "打开设置",
  "Open in separate window": "在独立窗口中打开",
  "Close settings": "关闭设置",
  "Close (Esc)": "关闭（Esc）",
  "Dismiss": "忽略",
  "Dismiss notification": "忽略通知",
};

const DYNAMIC_TRANSLATIONS: Array<[RegExp, (...groups: string[]) => string]> = [
  [/^(\d+) files? indexed$/i, (count) => `已索引 ${count} 个文件`],
  [/^(\d+) chunks?$/i, (count) => `${count} 个文本块`],
  [/^(\d+) tokens?$/i, (count) => `${count} 个 Token`],
  [/^(\d+) languages?$/i, (count) => `${count} 种语言`],
  [/^Connected — (\d+) languages? available \((\d+)ms\)$/i, (langs, ms) => `已连接——支持 ${langs} 种语言（${ms} 毫秒）`],
  [/^Connected — (\d+) languages? \((\d+)ms\)$/i, (langs, ms) => `已连接——支持 ${langs} 种语言（${ms} 毫秒）`],
  [/^Ready — (\d+) models? available$/i, (count) => `已就绪——有 ${count} 个模型可用`],
  [/^Found (\d+) action items?$/i, (count) => `找到 ${count} 个行动项`],
  [/^Showing (\d+) of (\d+)$/i, (shown, total) => `显示 ${shown}／${total}`],
  [/^(\d+) matches?$/i, (count) => `${count} 个匹配项`],
  [/^Page (\d+) of (\d+)$/i, (page, total) => `第 ${page}／${total} 页`],
  [/^Test failed:\s*(.+)$/i, (reason) => `测试失败：${reason}`],
  [/^Download failed:\s*(.+)$/i, (reason) => `下载失败：${reason}`],
  [/^Export failed:\s*(.+)$/i, (reason) => `导出失败：${reason}`],
  [/^Batch translation failed:\s*(.+)$/i, (reason) => `批量翻译失败：${reason}`],
  [/^Translated all (\d+) segments$/i, (count) => `已翻译全部 ${count} 条转写`],
  [/^All (\d+) segments already translated$/i, (count) => `${count} 条转写均已翻译`],
  [/^Translated (\d+) new segments \((\d+) already cached, (\d+) total\)$/i, (fresh, cached, total) => `已翻译 ${fresh} 条新内容（${cached} 条已有缓存，共 ${total} 条）`],
  [/^Model "(.+)" activated for (.+)$/i, (model, engine) => `模型“${model}”已为 ${engine} 启用`],
  [/^Activated "(.+)" for (.+)$/i, (model, engine) => `已为 ${engine} 启用“${model}”`],
  [/^Deleted (.+)$/i, (item) => `已删除 ${item}`],
  [/^Preset "(.+)" applied$/i, (preset) => `已应用预设“${preset}”`],
  [/^Hotkey updated:\s*(.+)$/i, (value) => `快捷键已更新：${value}`],
  [/^STT \((.+)\):\s*(.+)$/i, (party, message) => `语音识别（${party}）：${message}`],
  [/^STT:\s*(.+) connected \((.+)\)$/i, (provider, party) => `语音识别：${provider} 已连接（${party}）`],
];

const LOCALIZED_ATTRIBUTES = ["aria-label", "title", "placeholder", "data-tooltip"] as const;
const SKIP_SELECTOR = "[data-no-ui-translate], .prose, pre, code, kbd, [contenteditable='true']";

export function translateUiText(value: string): string {
  if (!/[A-Za-z]/.test(value)) return value;

  const match = value.match(/^(\s*)(.*?)(\s*)$/s);
  if (!match) return value;
  const [, leading, core, trailing] = match;
  if (!core) return value;

  const exact = EXACT_TRANSLATIONS[core];
  if (exact) return `${leading}${exact}${trailing}`;

  for (const [pattern, render] of DYNAMIC_TRANSLATIONS) {
    const dynamicMatch = core.match(pattern);
    if (dynamicMatch) return `${leading}${render(...dynamicMatch.slice(1))}${trailing}`;
  }

  return value;
}

function shouldSkip(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement;
  return Boolean(element?.closest(SKIP_SELECTOR));
}

function localizeTextNode(node: Text): void {
  if (shouldSkip(node)) return;
  const translated = translateUiText(node.data);
  if (translated !== node.data) node.data = translated;
}

function localizeAttributes(element: Element): void {
  if (shouldSkip(element)) return;
  for (const attribute of LOCALIZED_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const translated = translateUiText(value);
    if (translated !== value) element.setAttribute(attribute, translated);
  }
}

function localizeTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root as Text);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) localizeAttributes(root as Element);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current: Node | null = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) localizeTextNode(current as Text);
    else localizeAttributes(current as Element);
    current = walker.nextNode();
  }
}

let installed = false;

export function installChineseUi(): void {
  if (installed) return;
  installed = true;

  document.documentElement.lang = "zh-CN";
  document.title = "NexQ 中文助手";
  localizeTree(document.body);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        localizeTextNode(mutation.target as Text);
      } else if (mutation.type === "attributes") {
        localizeAttributes(mutation.target as Element);
      } else {
        mutation.addedNodes.forEach(localizeTree);
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...LOCALIZED_ATTRIBUTES],
  });
}
