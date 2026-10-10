// End-to-end smoke test for the real MathJax + Stone browser path.
// Run after installing Playwright and its Chromium browser.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { collisionCases, collisionCaseKeys } from '../public/collision-cases.js';

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

  // Real MathJax + Stone comparison for all seven collision classes.
  await page.locator('#document-font-size').selectOption('17');
  await page.locator('#document-width').evaluate(input => {
    input.value = '720';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  for (const key of collisionCaseKeys) {
    const fixture = collisionCases[key];
    await page.locator('#document-example').selectOption(key);
    await page.waitForFunction(({ key, source }) => {
      const status = document.getElementById('document-status');
      const metrics = document.getElementById('document-metrics').textContent;
      if (status.dataset.state !== 'ready' || !metrics) return false;
      const data = JSON.parse(metrics);
      return document.getElementById('document-example').value === key &&
        data.source === source && data.settings.width === 720 &&
        data.settings.fontSize === 17;
    }, { key, source: fixture.source }, { timeout: 30000 });
    const state = JSON.parse(await page.locator('#document-metrics').textContent());
    assert.equal(state.summary.status, 'composed', key);
    assert.equal(state.summary.geometry.length, fixture.expectedFormulaCount, key);
    assert.equal(await page.locator('[data-document-math]').count(), fixture.expectedFormulaCount, key);
    const drawn = await page.locator('.document-canvas').evaluate(canvas => {
      const base = canvas.getBoundingClientRect();
      return [...canvas.querySelectorAll('[data-document-math]')].map(svg => {
        const rect = svg.getBoundingClientRect();
        return {
          id: svg.dataset.documentMath,
          x: rect.x - base.x, y: rect.y - base.y,
          width: rect.width, height: rect.height,
          shapeCount: svg.querySelectorAll('path, use, text').length,
        };
      });
    });
    for (const [index, item] of drawn.entries()) {
      const expected = state.summary.geometry[index];
      assert.equal(item.id, expected.id, key);
      assert.ok(item.shapeCount > 0, key + ': empty math SVG');
      for (const dimension of ['x', 'y', 'width', 'height'])
        assert.ok(Math.abs(item[dimension] - expected[dimension]) < 0.3,
          key + ': visual and measured ' + dimension + ' differ');
    }
    if (key === 't04') {
      assert.ok(state.summary.lineCount >= 3);
      assert.deepEqual(state.summary.overlaps, []);
    }
    if (key === 't06a') {
      const formulaWidth = state.summary.geometry[0].width;
      assert.ok(formulaWidth > 80);
      const tooNarrow = Math.max(80, Math.ceil(formulaWidth) - 1);
      await page.locator('#document-width').evaluate((input, value) => {
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, tooNarrow);
      await page.waitForFunction(value => {
        const status = document.getElementById('document-status');
        const metrics = document.getElementById('document-metrics').textContent;
        return status.dataset.state === 'ready' && metrics &&
          JSON.parse(metrics).settings.width === value;
      }, tooNarrow, { timeout: 30000 });
      const tooNarrowState = JSON.parse(await page.locator('#document-metrics').textContent());
      assert.equal(tooNarrowState.summary.status, 'unsatisfied-width');
      assert.equal(await page.locator('[data-document-math]').count(), 0);
      assert.equal(await page.locator('#document-copy-source').inputValue(), fixture.source);
      await page.locator('#document-width').evaluate(input => {
        input.value = '720';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  }

  // T02: changing an outer spacing rule must change only the paragraph's
  // geometry, never source spaces or the measured math SVG.
  await page.locator('#document-example').selectOption('t02a');
  await page.locator('#document-width').evaluate(input => {
    input.value = '480';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#document-boundary-spacing').selectOption('contextual');
  await page.waitForFunction(() => {
    const status = document.getElementById('document-status');
    const raw = document.getElementById('document-metrics').textContent;
    return status.dataset.state === 'ready' && raw &&
      JSON.parse(raw).settings.boundarySpacing === 'contextual' &&
      document.getElementById('document-example').value === 't02a';
  });
  const a = JSON.parse(await page.locator('#document-metrics').textContent());
  assert.equal(a.summary.status, 'composed');
  assert.equal(a.summary.geometry.length, 1);
  const mathBefore = a.summary.geometry[0];
  assert.ok(mathBefore.boundary.appliedLeft > 0);
  assert.ok(mathBefore.boundary.appliedRight > 0);
  assert.equal(mathBefore.boundary.appliedLeft, 17 * 0.25);
  assert.equal(mathBefore.boundary.appliedRight, 17 * 0.25);
  assert.ok(!(await page.locator('#document-source').inputValue()).includes(' \\('));
  const actualBox = await page.locator('[data-document-math]').evaluate(svg => {
    const rect = svg.getBoundingClientRect();
    const base = svg.parentElement.getBoundingClientRect();
    return { x: rect.x - base.x, width: rect.width };
  });
  assert.ok(Math.abs(actualBox.x - mathBefore.x) < 0.3);
  assert.ok(Math.abs(actualBox.width - mathBefore.width) < 0.3);
  await page.screenshot({ path: 'artifacts/suushiki-boundary-contextual.png', fullPage: true });

  await page.locator('#document-example').selectOption('t02b');
  await page.waitForFunction(() => {
    const raw = document.getElementById('document-metrics').textContent;
    return document.getElementById('document-status').dataset.state === 'ready' &&
      raw && JSON.parse(raw).source === document.getElementById('document-source').value &&
      document.getElementById('document-example').value === 't02b';
  });
  const b = JSON.parse(await page.locator('#document-metrics').textContent());
  assert.equal(b.summary.geometry[0].boundary.requestedLeft, 0);
  assert.equal(b.summary.geometry[0].boundary.requestedRight, 0);
  assert.ok(b.source.includes('関数 '));
  assert.ok(b.source.includes(' を考える。'));
  assert.equal(b.summary.geometry[0].width, mathBefore.width);

  await page.locator('#document-example').selectOption('t02c');
  await page.waitForFunction(() => {
    const raw = document.getElementById('document-metrics').textContent;
    return document.getElementById('document-status').dataset.state === 'ready' &&
      raw && JSON.parse(raw).source === document.getElementById('document-source').value &&
      document.getElementById('document-example').value === 't02c';
  });
  const c = JSON.parse(await page.locator('#document-metrics').textContent());
  assert.deepEqual(c.summary.geometry.map(g => [g.boundary.requestedLeft, g.boundary.requestedRight]),
    [[4.25, 0], [0, 0], [0, 0]]);
  await page.locator('#document-boundary-spacing').selectOption('quarter');
  await page.waitForFunction(() => {
    const raw = document.getElementById('document-metrics').textContent;
    return document.getElementById('document-status').dataset.state === 'ready' &&
      raw && JSON.parse(raw).settings.boundarySpacing === 'quarter';
  });
  const q = JSON.parse(await page.locator('#document-metrics').textContent());
  assert.ok(q.summary.geometry.some(g => g.boundary.requestedRight > 0));
  assert.equal(q.source, c.source);

  // Reproducible LuaLaTeX reference, normalized against the browser em size.
  // This deliberately does not assert equality of line counts across fonts.
  await page.locator('#document-font-size').selectOption('20');
  await page.locator('#document-boundary-spacing').selectOption('elastic');
  await page.locator('#document-example').selectOption('t02d');
  await page.locator('#document-width').evaluate(input => {
    input.value = '240';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const raw = document.getElementById('document-metrics').textContent;
    if (document.getElementById('document-status').dataset.state !== 'ready' || !raw) return false;
    const data = JSON.parse(raw);
    return data.source === document.getElementById('document-source').value &&
      data.settings.boundarySpacing === 'elastic' &&
      data.settings.fontSize === 20 && data.settings.width === 240 &&
      data.latexComparison?.paragraph?.widthInTexZw === 12;
  }, null, { timeout: 30000 });
  const latexNarrow = JSON.parse(await page.locator('#document-metrics').textContent());
  assert.equal(latexNarrow.latexComparison.latex.xkanjiskipNaturalZw, 0.25);
  assert.equal(latexNarrow.latexComparison.latex.xkanjiskipStretchZw, 0.25);
  assert.equal(latexNarrow.latexComparison.latex.xkanjiskipShrinkZw, 0.125);
  assert.equal(latexNarrow.latexComparison.paragraph.latexLines, 2);
  assert.equal(latexNarrow.latexComparison.paragraph.comparable, false);
  assert.equal(latexNarrow.summary.elasticBudgets.reduce((n, item) =>
    n + item.appliedAdjustment, 0), 0);
  assert.ok(latexNarrow.summary.elasticBudgets.some(item => item.stretch > 0));
  assert.ok((await page.locator('#document-latex-compare').textContent()).includes('伸縮予算は診断専用'));
  await page.screenshot({ path: 'artifacts/suushiki-latex-reference-12zw.png', fullPage: true });
  await page.locator('#document-width').evaluate(input => {
    input.value = '480';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const raw = document.getElementById('document-metrics').textContent;
    return document.getElementById('document-status').dataset.state === 'ready' &&
      raw && JSON.parse(raw).latexComparison?.paragraph?.widthInTexZw === 24;
  }, null, { timeout: 30000 });
  const latexWide = JSON.parse(await page.locator('#document-metrics').textContent());
  assert.equal(latexWide.latexComparison.paragraph.latexLines, 1);
  assert.equal(latexWide.summary.geometry.length, 2);
  assert.equal(latexWide.source, latexNarrow.source);
  await page.screenshot({ path: 'artifacts/suushiki-latex-reference-24zw.png', fullPage: true });

  assert.deepEqual(errors, []);
  console.log('Browser smoke checks passed; screenshots saved in artifacts/.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
