// Explicit post-install smoke test. Connect only to a temporarily enabled local
// WebView debugging port. Invoke app-owned probes; never read an API key.
// Sends fixed synthetic text/audio to the user's configured services. API fees
// may apply. Never starts a meeting, microphone, system capture, or recording.
const { chromium } = require('./browser-runtime.cjs');
const expectedVersion = require('../package.json').version;
if (process.env.NEXQ_ALLOW_NETWORK_PROBES !== '1') {
  throw new Error('Set NEXQ_ALLOW_NETWORK_PROBES=1 to explicitly allow paid fixed-sample service probes.');
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9335');
  try {
    const pages = browser.contexts().flatMap(context => context.pages());
    const page = pages.find(p => /tauri\.localhost/.test(p.url()));
    if (!page) throw new Error('No local NexQ WebView found');
    await page.waitForFunction(() => window.__TAURI__?.core?.invoke);
    const metadata = await page.evaluate(async (expectedVersion) => {
      const invoke = window.__TAURI__.core.invoke;
      const config = JSON.parse(await invoke('get_rag_config'));
      const index = JSON.parse(await invoke('get_rag_status'));
      return { title: document.title, versionVisible: document.body.innerText.includes(expectedVersion), knowledgeFiles: index.total_files, knowledgeChunks: index.total_chunks, embeddingModel: config.embedding_model, indexStale: index.index_stale };
    }, expectedVersion);
    console.log('APP', JSON.stringify(metadata));
    await page.evaluate(async () => {
      window.__probeEventCount = 0;
      window.__probeUnlisteners = [];
      for (const event of ['llm_stream_start', 'llm_stream_token', 'llm_stream_end', 'llm_stream_error']) {
        window.__probeUnlisteners.push(await window.__TAURI__.event.listen(event, () => window.__probeEventCount++));
      }
    });
    const jobs = [
      ['model_generation', 'test_llm_generation', {}],
      ['question_translation', 'translate_text', { text: 'Could you confirm the delivery date?', sourceLang: 'en', targetLang: 'zh' }],
      ['translation_connection', 'test_translation_connection', { provider: 'llm' }],
      ['speech_synthetic_sample', 'test_stt_connection', { provider: 'whisper_api' }],
      ['knowledge_embedding', 'test_ollama_embedding_connection', {}],
    ];
    for (const [name, command, args] of jobs) {
      const started = Date.now();
      const result = await page.evaluate(async ({ command, args }) => {
        try { return { ok: true, value: await window.__TAURI__.core.invoke(command, args) }; }
        catch (error) { return { ok: false, error: String(error) }; }
      }, { command, args });
      console.log(name, JSON.stringify({ ...result, milliseconds: Date.now() - started }).replace(/sk-[A-Za-z0-9_*.-]+/g, '[redacted]'));
    }
    const events = await page.evaluate(() => { for (const unlisten of window.__probeUnlisteners) unlisten(); return window.__probeEventCount; });
    console.log('BACKGROUND_MEETING_EVENTS', events);
    if (events !== 0) throw new Error('Background probes contaminated the meeting stream');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
