import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedMeasurer } from '@non-standardworld/stone-engine.js';
import { collisionCases, collisionCaseKeys } from '../public/collision-cases.js';
import { parseDocument, documentSource } from '../public/document-source.js';
import { layoutDocument } from '../public/document-layout.js';

const options = { fontSize: 17, lineHeightScale: 1.6, punctuationMode: 'stone', kinsoku: true };
const measurer = new FixedMeasurer();
const WIDTH = 720;

function compose(key, { width = WIDTH, boxFactory, ...config } = {}) {
  const source = collisionCases[key].source;
  const items = parseDocument(source);
  const boxes = new Map(items.filter(item => item.type === 'math').map((item, index) =>
    [item.id, boxFactory?.(item, index) ?? { width: 68, ascent: 22, descent: 7 }]));
  return layoutDocument({ items, boxes, width, options, measurer, ...config });
}

test('all T01–T07 fixture variants retain source, math count and nonbreaking identities', () => {
  assert.deepEqual([...new Set(collisionCaseKeys.map(k => k.slice(0, 3)))],
    ['t01', 't02', 't03', 't04', 't05', 't06', 't07']);
  for (const key of collisionCaseKeys) {
    const fixture = collisionCases[key];
    const items = parseDocument(fixture.source);
    assert.equal(documentSource(items), fixture.source, key);
    assert.equal(items.filter(item => item.type === 'math').length, fixture.expectedFormulaCount, key);
    assert.ok(items.every(item => fixture.source.slice(item.start, item.end) ===
      (item.type === 'math' ? item.raw : item.text)), key);
    const result = compose(key);
    assert.equal(result.status, 'composed', key);
    assert.equal(result.source, fixture.source, key);
    assert.equal(result.geometry.length, fixture.expectedFormulaCount, key);
    assert.equal(result.geometry.length, result.runs.filter(run => run.mathId).length, key);
    assert.deepEqual(result.overlaps, [], key);
    for (const item of result.geometry) {
      assert.ok(item.width > 0 && item.ascent >= 0 && item.descent >= 0, key);
      assert.ok(item.x >= -1e-6 && item.x + item.width <= WIDTH + 1e-6, key);
    }
  }
});

test('T02: source whitespace is kept distinct from math objects', () => {
  const a = compose('t02a');
  const b = compose('t02b');
  assert.equal(a.runs.filter(run => run.char === ' ').length, 0);
  assert.equal(b.runs.filter(run => run.char === ' ').length, 2);
  assert.equal(a.mathItems[0].tex, b.mathItems[0].tex);
  assert.equal(a.mathItems[0].width, b.mathItems[0].width);
});

test('T03: punctuation and formula are never split when repair succeeds', () => {
  let repairs = 0;
  for (const key of ['t03a', 't03b']) for (let width = 80; width <= 230; width += 2) {
    const result = compose(key, { width });
    assert.equal(result.source, collisionCases[key].source);
    assert.equal(result.mathItems.length, 1);
    assert.equal(result.geometry.length, 1);
    if (result.repairs.some(repair => repair.applied)) repairs++;
    if (result.status === 'composed') {
      assert.deepEqual(result.boundaryViolations, []);
      assert.deepEqual(result.horizontalOverflows, []);
    }
  }
  assert.ok(repairs > 0, 'at least one width exercises the line-repair path');
});

test('T04: tall math changes line geometry only in the adaptive policy', () => {
  const boxes = (item, index) => index === 2
    ? { width: 70, ascent: 80, descent: 64 }
    : { width: 24, ascent: 17, descent: 3 };
  const adaptive = compose('t04', { boxFactory: boxes, policy: 'adaptive' });
  const fixed = compose('t04', { boxFactory: boxes, policy: 'fixed' });
  assert.equal(adaptive.lineCount, 3);
  assert.equal(fixed.lineCount, 3);
  assert.deepEqual(adaptive.overlaps, []);
  assert.ok(fixed.overlaps.length > 0);
  assert.equal(adaptive.geometry.length, fixed.geometry.length);
  assert.ok(adaptive.lines[2].top >= adaptive.lines[1].bottom);
});

test('T05–T06: width and formula identity do not silently rewrite source', () => {
  const narrow = compose('t05', { width: 110, boxFactory: () => ({ width: 90, ascent: 20, descent: 5 }) });
  assert.equal(narrow.geometry.length, 1);
  assert.equal(narrow.geometry[0].width, 90);
  const tooNarrow = compose('t06a', { width: 179, boxFactory: () => ({ width: 180, ascent: 20, descent: 5 }) });
  assert.equal(tooNarrow.status, 'unsatisfied-width');
  assert.equal(tooNarrow.displayAllowed, false);
  assert.equal(tooNarrow.source, collisionCases.t06a.source);
  const marginal = compose('t06a', { width: 181, boxFactory: () => ({ width: 180, ascent: 20, descent: 5 }) });
  assert.equal(marginal.mathItems.length, 1);
  assert.equal(marginal.geometry.length, 1);
  assert.equal(marginal.geometry[0].width, 180);
});

test('T07: math source ranges and IDs remain distinct from drawing placeholders', () => {
  const source = collisionCases.t07.source;
  const items = parseDocument(source);
  const math = items.filter(item => item.type === 'math');
  assert.deepEqual(math.map(m => m.tex), ['\\mathbb{R}', 'f(x)']);
  const result = compose('t07');
  assert.deepEqual(result.geometry.map(m => m.id), ['math-1', 'math-2']);
  assert.equal(result.source, source);
  for (const item of math) assert.equal(source.slice(item.start, item.end), item.raw);
});
