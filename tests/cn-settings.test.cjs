const { chromium, launchOptions } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch(launchOptions);
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5178/tests/settings-preview.html');
    await page.getByRole('button', { name: '测试模型生成', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '生成成功' }).waitFor();
    assert.equal(await page.evaluate(() => window.__settingsTest.stats.generations), 1);
    console.log('PASS: separate real-generation test command and result UI (mock IPC)');
    await page.evaluate(async () => {
      const t = window.__settingsTest;
      await t.translate('same sample', 'zh', 'en', 'llm');
      await t.translate('same sample', 'zh', 'en', 'llm');
      t.config.setState({ llmModel: 'test-model-two' });
      await t.translate('same sample', 'zh', 'en', 'llm');
    });
    assert.equal(await page.evaluate(() => window.__settingsTest.stats.translations), 2);
    console.log('PASS: model changes invalidate the assistant translation cache');
    const rag = await page.evaluate(async () => {
      const t = window.__settingsTest;
      t.rag.setState({ ragConfig: { embedding_model: 'original' }, indexStale: false });
      await t.rag.getState().refreshIndexStatus();
      const stale = t.rag.getState().indexStale;
      t.stats.failSave = true;
      await t.rag.getState().saveRagConfig({ embedding_model: 'not-saved' });
      return { stale, model: t.rag.getState().ragConfig.embedding_model, error: t.rag.getState().error };
    });
    assert.equal(rag.stale, true); assert.equal(rag.model, 'original'); assert.match(rag.error, /disk failure/);
    console.log('PASS: durable stale-index state and failed saves preserve UI configuration');
    const progress = await page.evaluate(async () => {
      const t = window.__settingsTest;
      t.rag.setState({ isIndexing: true });
      await t.emit('rag_index_progress', { status: 'complete', file_id: 'one-file', chunks_total: 4, chunks_embedded: 4 });
      const perFile = { indexing: t.rag.getState().isIndexing, chunks: t.rag.getState().indexProgress.chunksDone };
      await t.emit('rag_index_progress', { status: 'complete', total_files: 1 });
      return { perFile, complete: !t.rag.getState().isIndexing };
    });
    assert.deepEqual(progress, { perFile: { indexing: true, chunks: 4 }, complete: true });
    console.log('PASS: a completed staging file does not prematurely finish the full rebuild');
    await page.goto('http://127.0.0.1:5178/tests/settings-preview.html?kind=stt');
    await page.getByText('测试会将固定合成语音发送给 OpenAI', { exact: false }).waitFor();
    // A stored key shows the explicit retest button; it must not be deleted on failure.
    await page.getByRole('button', { name: /测试连接|重新测试|Test|Retest/ }).last().click();
    await page.waitForFunction(() => window.__settingsTest.stats.sttTests === 1);
    await page.getByText('不会自动删除密钥', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => window.__settingsTest.stats.deletedKeys), 0);
    await page.goto('http://127.0.0.1:5178/tests/settings-preview.html?kind=search');
    const key = page.getByLabel('Tavily API Key');
    const testSearch = page.getByRole('button', { name: '测试搜索', exact: true });
    assert.ok(await testSearch.isDisabled());
    await key.fill('test-fixture-key');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Tavily 密钥已保存' }).waitFor();
    assert.equal(await key.inputValue(), '');
    await testSearch.click();
    await page.getByRole('status').filter({ hasText: '搜索服务连接成功' }).waitFor();
    assert.equal(await page.evaluate(() => window.__settingsTest.stats.searchTests), 1);
    await page.getByRole('checkbox', { name: '为「生成回复」启用联网搜索' }).check();
    assert.equal(await page.evaluate(() => window.__settingsTest.actions.getState().configs.actions.Assist.webSearch), true);
    await page.getByRole('button', { name: '清除密钥', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '已清除 Tavily 密钥' }).waitFor();
    assert.ok(await testSearch.isDisabled());
    console.log('PASS: search credentials, test command, and live action toggle (mock IPC)');
    assert.deepEqual(errors, []);
    console.log('PASS: failed speech test keeps the saved API key; no uncaught UI errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
