// Inspect only this application's test WebViews; do not inspect credentials.
const { chromium } = require('./browser-runtime.cjs');
const expectedVersion = require('../package.json').version;
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9335');
  try {
    for (const page of browser.contexts().flatMap(context => context.pages())) {
      if (!/tauri\.localhost/.test(page.url())) continue;
      const result = await page.evaluate(async (expectedVersion) => {
        const appWindow = window.__TAURI__.window.getCurrentWindow();
        if (appWindow.label === 'launcher') {
          await appWindow.show();
        }
        return { window: appWindow.label, versionVisible: document.body.innerText.includes(expectedVersion), visible: await appWindow.isVisible() };
      }, expectedVersion);
      console.log(JSON.stringify(result));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
