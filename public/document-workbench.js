import { getSharedCanvasMeasurer } from '@non-standardworld/stone-engine.js';
import { parseDocument, documentExamples, MathSourceError } from './document-source.js';
import { layoutDocument } from './document-layout.js';
import { mountDocument } from './document-render.js';
import { collisionCases } from './collision-cases.js';
import { compareWithLatex, comparisonText } from './latex-compare.js';
import { mountNativeComparison, measureNativeComparison, nativeComparisonSummary } from './native-comparison.js';
import { typesetFlowableMath } from './mathjax-flow.js';
import { inspectNativeLineEdges, inspectStoneLineEdges } from './line-edge-analysis.js';
import { makeIsolationCase, measureIsolationCase } from './css-isolation.js';

const $ = id => document.getElementById(id);
const measurer = getSharedCanvasMeasurer();
const measurements = new Map();
const flowMeasurements = new Map();
let latexReference = null;
const round = n => Math.round(n * 1000) / 1000;
let requested = 0;
let running = false;
let record = null;
let currentMath = [];

function settings() {
  return {
    width: Number($('document-width').value),
    fontSize: Number($('document-font-size').value),
    family: $('document-font').value,
    policy: $('document-line-policy').value,
    boundaryPolicy: $('document-boundary-policy').value,
    conflictPolicy: $('document-conflict-policy').value,
    wordPolicy: $('document-word-policy').value,
    boundarySpacing: $('document-boundary-spacing').value,
    nativeMode: $('document-native-mode').value,
    showFrames: $('document-frames').checked,
    showBaselines: $('document-baselines').checked,
  };
}

async function measure(tex, config) {
  // Width is intentionally omitted: inline formulas are indivisible, and
  // MathJax's inline automatic line breaking is disabled in mathjax-config.js.
  const key = JSON.stringify([tex, config.fontSize, config.family, window.devicePixelRatio]);
  if (measurements.has(key)) return measurements.get(key);
  const row = document.createElement('span');
  Object.assign(row.style, {
    position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap',
    left: '0', top: '0', fontSize: config.fontSize + 'px',
    fontFamily: config.family, lineHeight: '2',
  });
  document.body.append(row);
  try {
    const metrics = window.MathJax.getMetricsFor(row, false);
    const math = await window.MathJax.tex2svgPromise(tex, { ...metrics, display: false });
    const probe = document.createElement('span');
    Object.assign(probe.style, {
      display: 'inline-block', width: '0', height: '0', verticalAlign: 'baseline',
    });
    row.append(math, probe);
    await document.fonts.ready;
    const svg = math.querySelector('svg');
    if (!svg || math.querySelector('[data-mml-node="merror"]') ||
        math.querySelectorAll('svg').length !== 1)
      throw new Error('数式を単一の SVG に変換できません: ' + tex);
    const rect = svg.getBoundingClientRect();
    const baseline = probe.getBoundingClientRect().top;
    const box = {
      width: rect.width, ascent: baseline - rect.top, descent: rect.bottom - baseline,
    };
    if (Object.values(box).some(n => !Number.isFinite(n) || n < 0) ||
        box.width <= 0 || box.ascent + box.descent <= 0)
      throw new Error('数式の測定寸法が不正です: ' + tex);
    const measured = { svg: svg.cloneNode(true), math: math.cloneNode(true), box };
    measurements.set(key, measured);
    return measured;
  } finally {
    row.remove();
  }
}

function disableActions(busy) {
  $('document-copy').disabled = busy;
  $('document-copy-math').disabled = busy || currentMath.length === 0;
  $('document-export').disabled = busy || !record;
}

function describe(result) {
  if (result.status === 'unsatisfied-width') {
    return '幅不足：' + result.oversized.map(m => m.id + ' は ' + round(m.requiredWidth) + ' px 必要').join('、') + '。描画は保留しています。';
  }
  if (result.status === 'unsatisfied-layout') {
    return '配置未充足：' + result.reason + '。原文は保持しています。';
  }
  const counts = result.boundaryViolations.length + ' 件の禁則違反、' +
    result.wordSplits.length + ' 件の欧文単語分割、' +
    result.horizontalOverflows.length + ' 件の横幅超過';
  const repair = result.repairs.length ?
    '／再分割 ' + result.repairs.filter(r => r.applied).length + '/' + result.repairs.length + ' 箇所' : '';
  const spacing = result.geometry.reduce((total, item) =>
    total + item.boundary.appliedLeft + item.boundary.appliedRight, 0);
  const generated = spacing ? '／自動アキ合計 ' + round(spacing) + ' px' : '';
  const fixed = result.overlaps.length ?
    '／行の占有領域が ' + result.overlaps.length + ' 組重複' : '';
  return result.status === 'composed' ?
    '配置完了：' + result.lineCount + ' 行、' + result.geometry.length + ' 個の数式。' + generated + repair + fixed :
    '制約衝突：' + counts + '。' + (result.displayAllowed ? '候補を表示しています。' : '描画を保留しています。') + repair + fixed;
}

function safeRecord(result, source, config) {
  const { ctx, runs, items, ...summary } = result;
  return {
    capturedAt: new Date().toISOString(),
    versions: { stone: '0.2.0', mathjax: window.MathJax.version },
    userAgent: navigator.userAgent, devicePixelRatio: window.devicePixelRatio,
    source, settings: config, summary,
    runs: (runs || []).map(run => ({
      char: run.mathId ? null : run.char, mathId: run.mathId ?? null,
      line: run.line, x: round(run.frame.x), y: round(run.frame.y),
      width: round(run.frame.width), height: round(run.frame.height),
    })),
  };
}

async function refresh() {
  requested++;
  if (running) return;
  running = true;
  disableActions(true);
  $('document-status').dataset.state = 'busy';
  let version;
  try {
    do {
      version = requested;
      record = null;
      currentMath = [];
      const source = $('document-source').value;
      $('document-copy-source').value = source;
      const config = settings();
      $('document-width-value').value = config.width + ' px';
      $('document-status').textContent = '計測中…';
      const items = parseDocument(source);
      const boxes = new Map();
      const svgById = new Map();
      const mathById = new Map();
      const flowById = new Map();
      const flowDetails = [];
      for (const item of items) {
        if (item.type !== 'math') continue;
        const measured = await measure(item.tex, config);
        boxes.set(item.id, measured.box);
        svgById.set(item.id, measured.svg);
        mathById.set(item.id, measured.math);
        const flowKey = JSON.stringify([
          item.tex, config.fontSize, config.family, config.width, window.devicePixelRatio,
        ]);
        let flow = flowMeasurements.get(flowKey);
        if (!flow) {
          flow = await typesetFlowableMath(item.tex, config);
          flowMeasurements.set(flowKey, flow);
        }
        flowById.set(item.id, flow.math);
        flowDetails.push({ id: item.id, svgFragments: flow.svgCount });
      }
      measurer.invalidate();
      const options = {
        fontSize: config.fontSize, lineHeightScale: 1.6,
        punctuationMode: 'stone', kinsoku: true,
        fonts: {
          japanese: { family: config.family },
          latin: { family: config.family },
        },
      };
      const result = layoutDocument({
        items, boxes, width: config.width, options, measurer,
        policy: config.policy, boundaryPolicy: config.boundaryPolicy,
        conflictPolicy: config.conflictPolicy, wordPolicy: config.wordPolicy,
        boundarySpacing: config.boundarySpacing,
      });
      if (version !== requested) continue;
      // Stone's original break candidate and fixed line advance, but the
      // measured math marker itself is supplied by the SUUSHIKI adapter.
      const stoneControl = layoutDocument({
        items, boxes, width: config.width, options, measurer,
        policy: 'fixed', boundaryPolicy: 'stone', conflictPolicy: 'inspect',
        wordPolicy: 'break', boundarySpacing: 'none',
      });
      const stonePreview = mountDocument(stoneControl, svgById, config);
      $('document-stone-output').replaceChildren(...(stonePreview ? [stonePreview] : []));
      const preview = mountDocument(result, svgById, config);
      $('document-output').replaceChildren(...(preview ? [preview] : []));
      const nativeElement = mountNativeComparison(items, mathById, config);
      $('document-native-output').replaceChildren(nativeElement);
      const nativeMeasurement = measureNativeComparison(nativeElement, items);
      $('document-native-diagnostic').textContent = nativeComparisonSummary(nativeMeasurement, result);
      const flowElement = mountNativeComparison(items, flowById,
        { ...config, mathFlow: 'breakable' });
      $('document-native-flow-output').replaceChildren(flowElement);
      const nativeFlowMeasurement = measureNativeComparison(flowElement, items);
      const stoneSummary = {
        engine: 'Stone original candidate + SUUSHIKI math box adapter (not stock Stone)',
        status: stoneControl.status,
        lineCount: stoneControl.lineCount ?? null,
        formulaCount: stoneControl.geometry?.length ?? 0,
        boundaryViolations: stoneControl.boundaryViolations ?? null,
        horizontalOverflows: stoneControl.horizontalOverflows ?? null,
        overlaps: stoneControl.overlaps ?? null,
        displayAllowed: stoneControl.displayAllowed,
      };
      $('document-fourway-diagnostic').textContent =
        '通常HTML・式内非分割：本文を含む行 ' + nativeMeasurement.textBearingLineCount +
        '、数式SVG ' + nativeMeasurement.mathFragmentCount + '片\n' +
        '通常HTML・式内改行あり：本文を含む行 ' + nativeFlowMeasurement.textBearingLineCount +
        '、数式SVG ' + nativeFlowMeasurement.mathFragmentCount + '片' +
        '、横はみ出し ' + (nativeFlowMeasurement.horizontalOverflow ? 'あり' : 'なし') + '\n' +
        'Stone候補（最小接続）：' + (stoneSummary.lineCount ?? '配置不能') +
        '行、状態 ' + stoneSummary.status + '\n' +
        'SUUSHIKI：' + (result.lineCount ?? '配置不能') + '行、状態 ' + result.status +
        '\n（HTMLは本文を含む行だけ、Stone/SUUSHIKIは段落の総行数です。）';
      $('document-diagnostic').textContent = describe(result);
      $('document-diagnostic').dataset.result =
        result.status === 'composed' && result.overlaps.length === 0 ? 'ok' : 'warning';
      record = safeRecord(result, source, config);
      record.nativeComparison = nativeMeasurement;
      record.nativeFlowComparison = nativeFlowMeasurement;
      record.flowDetails = flowDetails;
      record.stoneControl = stoneSummary;
      // Uses identical source offsets and one explicitly named Stone kinsoku
      // probe policy. This is an observation, not a generic JLREQ verdict.
      const edgeResults = {
        native: inspectNativeLineEdges(nativeElement, items, boxes),
        stone: inspectStoneLineEdges(stoneControl, items),
        suushiki: inspectStoneLineEdges(result, items),
      };
      record.edgeComparison = edgeResults;
      if (items.filter(item => item.type === 'math').length === 1) {
        const isolation = makeIsolationCase({
          source, boxes, mathById, width: config.width,
          fontSize: config.fontSize, family: config.family,
          variant: $('document-isolation-variant').value,
          lineBreak: $('document-isolation-linebreak').value,
        });
        $('document-isolation-output').replaceChildren(isolation.root);
        const measuredIsolation = measureIsolationCase(isolation);
        record.cssIsolationComparison = {
          ...measuredIsolation, sourceSubstituted: isolation.substitute,
        };
        $('document-isolation-diagnostic').textContent = [
          '条件: ' + measuredIsolation.variant +
            ' / line-break:' + measuredIsolation.lineBreak,
          '状態: ' + measuredIsolation.status +
            ' / 禁則プローブ: ' + measuredIsolation.violations.map(v =>
              v.edge + '「' + v.char + '」@' + v.offset).join('、'),
          '横はみ出し: ' + (measuredIsolation.overflow ? 'あり' : 'なし') +
            ' / 行頭位置: ' + measuredIsolation.lines.map(l => l.first).join(', '),
          isolation.substitute ? '※ 数式を文字に置換。元と同じ寸法ではありません。' :
            '※ 数式の幅・上昇・下降はMathJaxの実測値を利用。',
        ].join('\n');
      } else {
        $('document-isolation-output').replaceChildren();
        $('document-isolation-diagnostic').textContent =
          'この実験は数式が1個の原稿（T03a / T03bなど）を対象にします。';
        record.cssIsolationComparison = { status: 'requires-one-math-item' };
      }
      const edgeLine = (label, report) => label + '：' + report.status +
        '／行頭位置 ' + report.lines.slice(0, 12).map(l => l.first).join(', ') +
        (report.lines.length > 12 ? ' …' : '') +
        '／禁則プローブ ' + report.violations.map(v =>
          v.edge + '「' + v.char + '」@' + v.offset).join('、');
      $('document-edge-diagnostic').textContent = [
        edgeLine('通常HTML・数式非分割', edgeResults.native),
        edgeLine('Stone候補', edgeResults.stone),
        edgeLine('SUUSHIKI', edgeResults.suushiki),
        '行頭位置は原文のUTF-16文字位置。HTMLはDOM Range、数式は計測済み基線を参照。',
        'MathJaxの式内改行ありは、この単一数式ボックス用プローブの適用範囲外。',
      ].join('\n');
      if (latexReference) {
        const comparison = compareWithLatex(result, config, latexReference, collisionCases.t02d.source);
        record.latexComparison = comparison;
        $('document-latex-compare').textContent = comparisonText(comparison);
      } else {
        $('document-latex-compare').textContent = '参照スナップショットを読み込めませんでした。';
      }
      currentMath = items.filter(i => i.type === 'math').map(i => i.tex);
      const { runs, ...small } = record;
      $('document-metrics').textContent = JSON.stringify({
        ...small, runCount: runs.length,
      }, (_, value) => typeof value === 'number' ? round(value) : value, 2);
      $('document-status').textContent = '計測完了。原文と描画結果を比較できます。';
      $('document-status').dataset.state = 'ready';
    } while (version !== requested);
  } catch (error) {
    record = null;
    currentMath = [];
    $('document-output').replaceChildren();
    $('document-native-output').replaceChildren();
    $('document-native-flow-output').replaceChildren();
    $('document-stone-output').replaceChildren();
    $('document-native-diagnostic').textContent = '';
    $('document-fourway-diagnostic').textContent = '';
    $('document-edge-diagnostic').textContent = '';
    $('document-isolation-output').replaceChildren();
    $('document-isolation-diagnostic').textContent = '';
    $('document-diagnostic').textContent = '';
    $('document-metrics').textContent = '';
    $('document-latex-compare').textContent = '';
    $('document-status').textContent = 'エラー：' + error.message;
    $('document-status').dataset.state = 'error';
    // A user typing an unfinished delimiter is an expected validation state.
    if (!(error instanceof MathSourceError)) console.error(error);
  } finally {
    running = false;
    disableActions(false);
    // An obsolete rendering error must not swallow input arriving during await.
    if (version !== requested) void refresh();
  }
}

async function copyText(value, label) {
  try {
    await navigator.clipboard.writeText(value);
    $('document-copy-status').textContent = label + ' をコピーしました。';
  } catch {
    $('document-copy-source').focus();
    $('document-copy-source').select();
    $('document-copy-status').textContent = 'コピーが拒否されました。下の原文を選択しました。Ctrl+C を使用してください。';
  }
}

$('document-copy').addEventListener('click', () => copyText($('document-source').value, '原文'));
$('document-copy-math').addEventListener('click', () => copyText(currentMath.join('\n'), '数式 TeX'));
$('document-export').addEventListener('click', () => {
  if (!record) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'suushiki-document-measurements.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('document-example').addEventListener('change', () => {
  const key = $('document-example').value;
  const fixture = collisionCases[key];
  $('collision-focus').textContent = fixture ? fixture.focus : '';
  $('document-source').value = fixture ? fixture.source : documentExamples[key];
  refresh();
});

for (const id of [
  'document-source', 'document-width', 'document-font-size', 'document-font',
  'document-line-policy', 'document-boundary-policy', 'document-conflict-policy',
  'document-word-policy', 'document-boundary-spacing', 'document-native-mode',
  'document-frames', 'document-baselines',
  'document-isolation-variant', 'document-isolation-linebreak',
]) $(id).addEventListener('input', refresh);

document.fonts.addEventListener('loadingdone', () => {
  measurements.clear();
  flowMeasurements.clear();
  refresh();
});

$('document-source').value = documentExamples.mixed;
$('document-copy-source').value = documentExamples.mixed;
try {
  if (document.readyState !== 'complete') {
    await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  }
  if (!window.MathJax?.startup?.promise) throw new Error('MathJax が読み込めませんでした。npm ci と再起動を確認してください。');
  await window.MathJax.startup.promise;
  try {
    const response = await fetch('/latex-reference.json');
    if (response.ok) latexReference = await response.json();
  } catch { /* The layout workbench remains usable without the benchmark. */ }
  if (!measurer) throw new Error('Canvas 2D に対応したブラウザーが必要です。');
  await refresh();
} catch (error) {
  $('document-status').textContent = 'エラー：' + error.message;
  $('document-status').dataset.state = 'error';
}
