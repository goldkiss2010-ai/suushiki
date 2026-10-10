// End-to-end smoke test for the real MathJax + Stone browser path.
// Run after installing Playwright and its Chromium browser.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:5173';
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, PORT: '5173' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', chunk => { output += String(chunk); });
server.stderr.on('data', chunk => { output += String(chunk); });

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error('Local server exited: ' + output);
    try {
      const response = await fetch(base + '/document.html');
      if (response.ok) return;
    } catch { /* Server has not bound yet. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Local server was not ready: ' + output);
}

async function ready(page) {
  await page.waitForFunction(() => {
    const status = document.getElementById('document-status');
    return status?.dataset.state === 'ready' || status?.dataset.state === 'error';
  }, { timeout: 60000 });
  const status = await page.locator('#document-status').textContent();
  assert.equal(await page.locator('#document-status').getAttribute('data-state'), 'ready', status);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 860 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(base + '/document.html', { waitUntil: 'load' });
  await ready(page);
  const source = await page.locator('#document-source').inputValue();
  assert.ok(source.includes('\\(f(x)=x^2\\)'));
  assert.equal(await page.locator('[data-document-math]').count(), 7);
  const summary = JSON.parse(await page.locator('#document-metrics').textContent()).summary;
  assert.equal(summary.source, source);
  assert.equal(summary.geometry.length, 7);
  assert.equal(summary.status, 'composed');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/suushiki-document-480.png', fullPage: true });

  // Width changes must preserve source, math identity, and container geometry.
  await page.locator('#document-width').evaluate(input => {
    input.value = '240';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await ready(page);
  assert.equal(await page.locator('[data-document-math]').count(), 7);
  assert.equal(await page.locator('#document-source').inputValue(), source);
  const width = await page.locator('.document-canvas').evaluate(el => el.getBoundingClientRect().width);
  assert.equal(width, 240);
  await page.screenshot({ path: 'artifacts/suushiki-document-240.png', fullPage: true });

  // Syntax errors cannot render a misleading previous document.
  await page.locator('#document-source').fill('途中で終わる数式 \\(x');
  await page.locator('#document-status[data-state="error"]').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('[data-document-math]').count(), 0);
  assert.equal(await page.locator('#document-copy-source').inputValue(), '途中で終わる数式 \\(x');

  // A different example should recover without reloading the page.
  await page.locator('#document-example').selectOption('boundaries');
  await ready(page);
  assert.ok(await page.locator('[data-document-math]').count() > 1);
  assert.deepEqual(errors, []);
  console.log('Browser smoke checks passed; screenshots saved in artifacts/.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
