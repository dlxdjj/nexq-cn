// Optional test tooling is not bundled with the desktop application.
const { chromium } = require(process.env.NEXQ_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

const launchOptions = { headless: true };
if (process.env.NEXQ_BROWSER_EXECUTABLE) {
  launchOptions.executablePath = process.env.NEXQ_BROWSER_EXECUTABLE;
} else if (process.platform === 'win32') {
  launchOptions.channel = 'msedge';
}

function artifactPath(filename) {
  const outputDirectory = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(outputDirectory, { recursive: true });
  return path.join(outputDirectory, filename);
}

module.exports = { chromium, launchOptions, artifactPath };
