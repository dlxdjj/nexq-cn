const { chromium, launchOptions } = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch(launchOptions);
  const errors = [];
  try {
    for (const label of ['launcher', 'overlay']) {
      const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
      page.on('pageerror', (error) => errors.push(label + ': ' + error.message));
      await page.goto('http://127.0.0.1:5178/tests/cn-preview.html?app=' + label);
      if (label === 'launcher') await page.waitForFunction(() => window.__cnTest?.stats.shortcutRegistrations === 3);
      else await page.getByRole('region', { name: '检测到的问题' }).waitFor();
      await page.waitForTimeout(200);
      assert.equal(await page.getByRole('region', { name: '检测到的问题' }).count(), label === 'overlay' ? 1 : 0, 'Only the overlay mounts question/translation UI');
      await page.evaluate(async () => {
        await window.__cnTest.emit('tray_start_meeting');
        await window.__cnTest.emit('tray_toggle_mic');
      });
      await page.waitForTimeout(200);
      const stats = await page.evaluate(() => window.__cnTest.stats);
      assert.equal(stats.starts, label === 'launcher' ? 1 : 0, 'One window owns tray start');
      assert.equal(stats.muteCalls, label === 'launcher' ? 1 : 0, 'One window owns tray mute');
      assert.equal(stats.shortcutRegistrations, label === 'launcher' ? 3 : 0, 'One window owns global shortcuts');
      if (label === 'launcher') assert.equal(stats.translations, 0, 'Hidden launcher must not request assistant translations');
      console.log('PASS: ' + label + ' window ownership, tray events, shortcuts, and translation isolation');
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: both real App render paths have no uncaught browser errors (mock native IPC)');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
