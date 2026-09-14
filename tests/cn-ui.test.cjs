const { chromium, launchOptions, artifactPath } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5178/tests/cn-preview.html');
    await page.getByText('你们如何保护客户数据？部署需要多长时间？', { exact: true }).last().waitFor();
    await page.getByRole('region', { name: '检测到的问题' }).getByRole('button', { name: '生成回复', exact: true }).click();
    await page.getByText('我们对存储和传输中的客户数据进行加密。', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__cnTest.streaming()), true, 'Chinese translation must appear before stream end');
    await page.getByRole('button', { name: '已生成 · 再次生成', exact: true }).waitFor();
    await page.getByText('我可以和交付团队确认具体范围。', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__cnTest.stats.generations), 1);
    await page.getByText('查看 1 个实际检索片段与文件来源', { exact: true }).click();
    await page.getByText('[Source 1] 示例产品资料.md（虚构测试资料） · 片段 1', { exact: true }).waitFor();
    await page.getByText('查看 1 个实际检索片段与文件来源', { exact: true }).click();
    await page.getByRole('tabpanel', { name: 'AI 回复内容' }).evaluate((element) => { element.scrollTop = 0; });
    await page.screenshot({ path: artifactPath('bilingual-ui.png'), fullPage: true });
    console.log('PASS: bilingual streaming, question association and evidence display');

    await page.setViewportSize({ width: 500, height: 560 });
    for (const name of ['结束会议', '暂停识别']) {
      const button = page.getByRole('button', { name, exact: true });
      const box = await button.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 500 && box.y + box.height <= 560, name + ' must stay visible');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', { name: '暂停识别', exact: true }).click();
    await page.getByRole('button', { name: '恢复识别', exact: true }).waitFor();
    await page.getByRole('button', { name: '恢复识别', exact: true }).click();
    await page.screenshot({ path: artifactPath('bilingual-ui-narrow.png'), fullPage: true });
    console.log('PASS: 500x560 layout and pause/resume control');

    await page.evaluate(() => window.__cnTest.noMatch());
    await page.getByText('知识库：未找到达到阈值的资料，请勿将建议视为已核实事实', { exact: true }).waitFor();
    console.log('PASS: missing-evidence warning');
    await page.evaluate(() => { window.__cnTest.stats.failGeneration = true; });
    await page.getByRole('button', { name: '已生成 · 再次生成', exact: true }).click();
    await page.getByRole('button', { name: '重试生成', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '已生成 · 再次生成', exact: true }).count(), 0);
    await page.evaluate(() => { window.__cnTest.stats.failGeneration = false; });
    await page.getByRole('button', { name: '重试生成', exact: true }).click();
    await page.getByRole('button', { name: '已生成 · 再次生成', exact: true }).waitFor();
    console.log('PASS: generation failure is not marked answered and retry succeeds');

    await page.evaluate(() => { window.__cnTest.stats.failTranslation = true; window.__cnTest.newReply('I will confirm the price.'); });
    await page.getByRole('button', { name: '部分翻译失败，点击重试（已完成的译文保留）', exact: true }).waitFor();
    await page.evaluate(() => { window.__cnTest.stats.failTranslation = false; });
    await page.getByRole('button', { name: '部分翻译失败，点击重试（已完成的译文保留）', exact: true }).click();
    await page.getByText('我会确认价格。', { exact: true }).waitFor();
    console.log('PASS: failed sentence translation can be retried');

    await page.evaluate(() => { window.__cnTest.clear(); window.__cnTest.stats.generations = 0; window.__cnTest.automatic(true); window.__cnTest.seed('What is the price?', 'same-accumulated-segment'); });
    await page.waitForFunction(() => window.__cnTest.stats.generations === 1);
    await page.waitForFunction(() => !window.__cnTest.streaming());
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => window.__cnTest.stats.generations), 1, 'automatic reply must not loop');
    await page.evaluate(() => window.__cnTest.seed('What is the price? Could you confirm the support?', 'same-accumulated-segment'));
    await page.waitForFunction(() => window.__cnTest.stats.generations === 2);
    await page.waitForFunction(() => !window.__cnTest.streaming());
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => window.__cnTest.stats.generations), 2, 'changed text within the same STT segment must trigger once');
    console.log('PASS: accumulated question changes are not skipped or repeatedly answered');
    await page.getByRole('button', { name: '结束会议', exact: true }).click();
    await page.waitForFunction(() => window.__cnTest.stats.ended);
    console.log('PASS: automatic reply runs once and end control dispatches');
    assert.deepEqual(errors, []);
    console.log('PASS: no uncaught browser errors; all UI tests use mock services, no meeting data transmitted');
  } catch (error) {
    await page.screenshot({ path: artifactPath('bilingual-ui-failure.png'), fullPage: true });
    console.error('Browser errors:', errors);
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
