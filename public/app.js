import { layoutText, getSharedCanvasMeasurer, svgString } from '/vendor/stone/index.js';

const $ = id => document.getElementById(id);
const cases = [
  ['simple', 'f(x)=x^2'],
  ['fraction', String.raw`\frac{1}{1+x^2}`],
  ['tall', String.raw`\dfrac{\sum_{k=1}^{n} k^2}{1+\dfrac{1}{x}}`],
  ['blackboard', String.raw`x\in\mathbb{R}`],
];
let record;
let requested = 0;
let running = false;
const measurer = getSharedCanvasMeasurer();
const rounded = value => Math.round(value * 1000) / 1000;

function readSettings() {
  return { width: Number($('width').value), fontSize: Number($('font-size').value),
    family: $('font').value, showFrames: $('frames').checked };
}

function renderStone(settings) {
  measurer.invalidate();
  const options = { fontSize: settings.fontSize, lineHeightScale: 1.6,
    punctuationMode: 'stone', kinsoku: true,
    fonts: { japanese: { family: settings.family }, latin: { family: settings.family } } };
  const ctx = layoutText($('source').value, options, measurer, { width: settings.width });
  $('stone-output').style.width = `${settings.width}px`;
  $('stone-output').innerHTML = svgString(ctx, { showFrames: settings.showFrames });
  $('stone-source').textContent = $('source').value;
  const summary = { lineCount: ctx.lineCount, renderedSize: ctx.renderedSize,
    isTruncated: ctx.isTruncated };
  $('stone-metrics').textContent = JSON.stringify(summary, null, 2);
  return { source: $('source').value, options, ...summary, runs: ctx.runs };
}

async function renderMath(settings) {
  const output = $('math-output');
  output.replaceChildren();
  const results = [];
  for (const [id, tex] of cases) {
    const article = document.createElement('article');
    article.className = 'math-case';
    article.dataset.case = id;
    const label = document.createElement('code');
    label.textContent = tex;
    const row = document.createElement('div');
    row.className = 'math-row';
    row.style.width = `${settings.width}px`;
    row.style.fontSize = `${settings.fontSize}px`;
    row.style.fontFamily = settings.family;
    article.append(label, row);
    output.append(article);
    const metrics = window.MathJax.getMetricsFor(row, false);
    const math = await window.MathJax.tex2svgPromise(tex, { ...metrics, display: false });
    const probe = document.createElement('span');
    probe.className = 'baseline-probe';
    probe.setAttribute('aria-hidden', 'true');
    row.append(math, probe);
    await document.fonts.ready;
    const svg = math.querySelector('svg');
    if (!svg || math.querySelector('[data-mml-node="merror"]')) {
      throw new Error(`${id}: 数式の変換に失敗しました。`);
    }
    const rect = svg.getBoundingClientRect();
    const baselineY = probe.getBoundingClientRect().top;
    const line = document.createElement('span');
    line.className = 'baseline';
    line.style.left = '0';
    line.style.top = `${baselineY - row.getBoundingClientRect().top}px`;
    row.append(line);
    const geometry = { width: rounded(rect.width), height: rounded(rect.height),
      ascent: rounded(baselineY - rect.top), descent: rounded(rect.bottom - baselineY),
      viewBox: svg.getAttribute('viewBox'), svgCount: math.querySelectorAll('svg').length };
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(geometry, null, 2);
    article.append(pre);
    results.push({ id, tex, metrics, ...geometry });
  }
  return results;
}

async function update() {
  requested++;
  if (running) return;
  running = true;
  $('download').disabled = true;
  $('status').dataset.state = 'busy';
  try {
    let version;
    do {
      version = requested;
      $('status').textContent = '計測中…';
      await document.fonts.ready;
      const settings = readSettings();
      $('width-value').value = `${settings.width} px`;
      const stone = renderStone(settings);
      const math = await renderMath(settings);
      record = { capturedAt: new Date().toISOString(), userAgent: navigator.userAgent,
        devicePixelRatio, versions: { stone: '0.2.0', mathjax: window.MathJax.version },
        settings, stone, math };
    } while (version !== requested);
    $('status').textContent = '単体確認 OK：Stone と MathJax の表示・計測が完了しました。';
    $('status').dataset.state = 'ready';
    $('download').disabled = false;
  } catch (error) {
    $('status').textContent = `エラー：${error.message}`;
    $('status').dataset.state = 'error';
    console.error(error);
  } finally { running = false; }
}

$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'suushiki-measurements.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

try {
  if (document.readyState !== 'complete') {
    await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  }
  if (!window.MathJax?.startup?.promise) throw new Error('MathJax を読み込めませんでした。npm ci と再起動を確認してください。');
  await window.MathJax.startup.promise;
  if (!measurer) throw new Error('Canvas 2D が使えるブラウザーで開いてください。');
  for (const id of ['width', 'font-size', 'font', 'frames', 'source']) {
    $(id).addEventListener('input', update);
  }
  document.fonts.addEventListener('loadingdone', update);
  await update();
} catch (error) {
  $('status').textContent = `エラー：${error.message}`;
  $('status').dataset.state = 'error';
  console.error(error);
}
