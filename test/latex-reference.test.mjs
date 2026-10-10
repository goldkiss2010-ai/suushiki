import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FixedMeasurer } from '@non-standardworld/stone-engine.js';
import { parseDimension, parseGlue, parseLatexLog, derivedReference } from '../scripts/parse-tex-reference.mjs';
import { compareWithLatex, comparisonText } from '../public/latex-compare.js';
import { collisionCases } from '../public/collision-cases.js';
import { parseDocument } from '../public/document-source.js';
import { layoutDocument } from '../public/document-layout.js';
import { mathBoundaryGaps } from '../public/math-boundary.js';

const reference = JSON.parse(readFileSync(new URL('../public/latex-reference.json', import.meta.url), 'utf8'));
const options = { fontSize: 20, lineHeightScale: 1.6, punctuationMode: 'stone', kinsoku: true };
function compose(source, width = 240, boundarySpacing = 'elastic') {
  const items = parseDocument(source);
  const boxes = new Map(items.filter(item => item.type === 'math')
    .map(item => [item.id, { width: 42, ascent: 18, descent: 5 }]));
  return layoutDocument({ items, boxes, width, options,
    measurer: new FixedMeasurer(), boundarySpacing });
}

test('TeX parser validates dimensions, flexible glue and paragraph tags', () => {
  assert.equal(parseDimension('43.00021pt'), 43.00021);
  assert.deepEqual(parseGlue('2.5pt plus 2.5pt minus 1.25pt'),
    { naturalPt: 2.5, stretchPt: 2.5, shrinkPt: 1.25 });
  assert.deepEqual(parseGlue('0.0pt plus 2.5pt'),
    { naturalPt: 0, stretchPt: 2.5, shrinkPt: 0 });
  assert.throws(() => parseDimension('2.5px'), /dimension/);
  assert.throws(() => parseGlue('1pt plus 2fil'), /glue/);
  const log = [
    'SUUSHIKI|parameter|mathsurround|0.0pt',
    'SUUSHIKI|parameter|xkanjiskip|2.5pt plus 2.5pt minus 1.25pt',
    'SUUSHIKI|parameter|kanjiskip|0.0pt plus 2.5pt',
    'SUUSHIKI|parameter|zw|10.0pt',
    ...Object.entries(reference.hboxesPt).map(([key, value]) =>
      'SUUSHIKI|hbox|' + key + '|' + value + 'pt'),
    ...Object.entries(reference.partsPt).map(([key, value]) =>
      'SUUSHIKI|part|' + key + '|' + value + 'pt'),
    ...Object.entries(reference.paragraphs).map(([key, p]) =>
      'SUUSHIKI|paragraph|' + key + '|' +
      [p.lineCount, p.heightSp, p.depthSp].join('|')),
  ].join('\n');
  const parsed = parseLatexLog(log);
  assert.deepEqual(parsed.parameters, reference.parameters);
  assert.deepEqual(parsed.paragraphs, reference.paragraphs);
  assert.throws(() => parseLatexLog(log.replace('SUUSHIKI|hbox|t02c', 'SUUSHIKI|hbox|t99')),
    /Missing hbox/);
});

test('captured real LuaLaTeX log reproduces the committed numeric baseline', () => {
  const log = readFileSync(new URL('../benchmarks/latex/reference-log.txt', import.meta.url), 'utf8');
  const parsed = parseLatexLog(log);
  assert.deepEqual(parsed.parameters, reference.parameters);
  assert.deepEqual(parsed.hboxesPt, reference.hboxesPt);
  assert.deepEqual(parsed.partsPt, reference.partsPt);
  assert.deepEqual(parsed.paragraphs, reference.paragraphs);
});

test('saved LuaLaTeX baseline agrees with its own measured T02a width decomposition', () => {
  const d = derivedReference(reference);
  assert.equal(reference.schemaVersion, 1);
  assert.equal(d.naturalPerZw, 0.25);
  assert.equal(d.stretchPerZw, 0.25);
  assert.equal(d.shrinkPerZw, 0.125);
  assert.ok(Math.abs(d.observedTwoBoundaryGapPt - 5) < 1e-4);
  assert.equal(d.expectedTwoBoundaryGapPt, 5);
  assert.equal(reference.paragraphs['t02a-twice-12zw'].lineCount, 2);
  assert.equal(reference.paragraphs['t02a-twice-24zw'].lineCount, 1);
});

test('experimental elastic rule preserves natural geometry and tracks unused flexibility', () => {
  const source = collisionCases.t02a.source;
  const items = parseDocument(source);
  const mathIndex = items.findIndex(item => item.type === 'math');
  const gap = mathBoundaryGaps(items, mathIndex, { policy: 'elastic', fontSize: 20 });
  assert.deepEqual(gap.leftGlue, { natural: 5, stretch: 5, shrink: 2.5 });
  assert.deepEqual(gap.rightGlue, gap.leftGlue);
  const dynamic = compose(source);
  const fixed = compose(source, 240, 'contextual');
  assert.equal(dynamic.status, 'composed');
  assert.equal(fixed.status, 'composed');
  assert.deepEqual(dynamic.geometry.map(g => [g.x, g.width]),
    fixed.geometry.map(g => [g.x, g.width]));
  assert.equal(dynamic.elasticBudgets.reduce((n, line) => n + line.stretch, 0), 10);
  assert.equal(dynamic.elasticBudgets.reduce((n, line) => n + line.shrink, 0), 5);
  assert.ok(dynamic.elasticBudgets.every(line => line.appliedAdjustment === 0));
});

test('line-edge reflow retracts glue budgets along with natural margin', () => {
  let found;
  for (let width = 45; width <= 100; width++) {
    const result = compose('あ\\(x\\)い', width);
    if (result.status === 'composed' && result.geometry[0].line > 0 &&
        result.geometry[0].boundary.appliedLeft === 0) { found = result; break; }
  }
  assert.ok(found);
  assert.equal(found.geometry[0].boundary.requestedGlueLeft.stretch, 5);
  assert.equal(found.geometry[0].boundary.appliedGlueLeft.stretch, 0);
  assert.equal(found.geometry[0].width, 42);
});

test('reference comparison distinguishes normalized diagnostics from exact font parity', () => {
  const result = compose(collisionCases.t02d.source, 240, 'elastic');
  const diagnostic = compareWithLatex(result, { width: 240, fontSize: 20 }, reference, collisionCases.t02d.source);
  assert.equal(diagnostic.directPixelParity, false);
  assert.equal(diagnostic.latex.xkanjiskipNaturalZw, 0.25);
  assert.equal(diagnostic.latex.xkanjiskipStretchZw, 0.25);
  assert.equal(diagnostic.latex.xkanjiskipShrinkZw, 0.125);
  assert.equal(diagnostic.paragraph.widthInTexZw, 12);
  assert.equal(diagnostic.paragraph.latexLines, 2);
  assert.equal(diagnostic.paragraph.suushikiLines, result.lineCount);
  assert.equal(diagnostic.paragraph.comparable, false);
  assert.match(comparisonText(diagnostic), /フォントが違う/);
  const generic = compareWithLatex(compose('未知\\(x\\)の場合'), { width: 240, fontSize: 20 }, reference, collisionCases.t02d.source);
  assert.equal(generic.paragraph, null);
});
