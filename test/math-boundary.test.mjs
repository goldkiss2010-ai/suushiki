import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedMeasurer } from '@non-standardworld/stone-engine.js';
import { parseDocument, documentSource } from '../public/document-source.js';
import { layoutDocument } from '../public/document-layout.js';
import { mathBoundaryGaps } from '../public/math-boundary.js';

const fontSize = 20;
const options = { fontSize, lineHeightScale: 1.6, punctuationMode: 'stone', kinsoku: true };
function compose(source, width = 480, boundarySpacing = 'contextual', other = {}) {
  const items = parseDocument(source);
  const boxes = new Map(items.filter(item => item.type === 'math')
    .map(item => [item.id, { width: 40, ascent: 18, descent: 4 }]));
  return layoutDocument({ items, boxes, width, options, measurer: new FixedMeasurer(),
    boundarySpacing, ...other });
}

test('three policies distinguish input spaces, punctuation, and generated gaps', () => {
  const adjacent = '関数\\(x\\)を考える。';
  const none = compose(adjacent, 480, 'none');
  const quarter = compose(adjacent, 480, 'quarter');
  const contextual = compose(adjacent, 480, 'contextual');
  for (const result of [none, quarter, contextual]) {
    assert.equal(result.status, 'composed');
    assert.equal(result.source, adjacent);
    assert.equal(documentSource(result.items), adjacent);
    assert.equal(result.geometry.length, 1);
  }
  assert.equal(none.geometry[0].boundary.appliedLeft, 0);
  assert.equal(none.geometry[0].boundary.appliedRight, 0);
  for (const result of [quarter, contextual]) {
    assert.equal(result.geometry[0].boundary.appliedLeft, 5);
    assert.equal(result.geometry[0].boundary.appliedRight, 5);
  }
  assert.equal(quarter.runs.some(run => run.char === ' '), false);
  const spaced = compose('関数 \\(x\\) を考える。');
  assert.equal(spaced.status, 'composed');
  assert.equal(spaced.geometry[0].boundary.requestedLeft, 0);
  assert.equal(spaced.geometry[0].boundary.requestedRight, 0);
  assert.equal(spaced.runs.filter(r => r.char === ' ').length, 2);
  const punctuation = '値\\(x\\)、\\(y\\)。また（\\(z\\)）を用いる。';
  const ctx = compose(punctuation);
  const broad = compose(punctuation, 480, 'quarter');
  assert.equal(ctx.status, 'composed');
  assert.equal(broad.status, 'composed');
  assert.deepEqual(ctx.geometry.map(g => [g.boundary.requestedLeft, g.boundary.requestedRight]),
    [[5, 0], [0, 0], [0, 0]]);
  assert.ok(broad.geometry.filter(g => g.boundary.requestedRight > 0).length >= 2);
});

test('soft line edges retract only generated margins, not source whitespace', () => {
  const source = 'あ\\(x\\)い';
  const found = [];
  for (let width = 45; width <= 100; width++) {
    const result = compose(source, width);
    if (result.status !== 'composed') continue;
    const g = result.geometry[0];
    if (g.line > 0 && g.boundary.appliedLeft === 0) found.push({ width, result, g });
    if (found.length >= 1) break;
  }
  assert.ok(found.length, 'formula can become the first item of a soft-wrapped line');
  const { result, g } = found[0];
  assert.equal(g.boundary.requestedLeft, 5);
  assert.equal(g.boundary.appliedLeft, 0);
  assert.equal(result.source, source);
  assert.equal(result.horizontalOverflows.length, 0);
  assert.equal(result.boundaryViolations.length, 0);
  assert.equal(result.runs.length, 3);
  const alone = compose('\\(x\\)', 40);
  assert.equal(alone.status, 'composed');
  assert.equal(alone.geometry[0].x, 0);
  assert.equal(alone.geometry[0].boundary.appliedLeft, 0);
  assert.equal(alone.geometry[0].boundary.appliedRight, 0);
});

test('narrow formula and punctuation never silently shed source or measured expression width', () => {
  const source = '条件は（\\(a+b=c\\)）で与えられる。';
  for (const policy of ['none', 'quarter', 'contextual']) {
    for (let width = 80; width <= 190; width += 2) {
      const result = compose(source, width, policy);
      assert.equal(result.source, source);
      assert.equal(result.mathItems[0].width, 40);
      assert.equal(result.geometry.length, 1);
      assert.equal(result.geometry[0].width, 40);
      if (result.status === 'composed') {
        assert.deepEqual(result.horizontalOverflows, []);
        assert.deepEqual(result.boundaryViolations, []);
      }
    }
  }
});

test('hard-break boundaries, adjacent math, Latin prose and invalid settings are explicit', () => {
  const src = '\\(x\\)\\(y\\)';
  const result = compose(src);
  assert.equal(result.status, 'composed');
  assert.equal(result.geometry.length, 2);
  assert.ok(result.geometry.every(g => g.boundary.requestedLeft === 0 && g.boundary.requestedRight === 0));
  const multiline = compose('前\n' + '\\(x\\)' + '\n後');
  assert.equal(multiline.status, 'composed');
  assert.equal(multiline.geometry[0].boundary.requestedLeft, 0);
  assert.equal(multiline.geometry[0].boundary.requestedRight, 0);
  const items = parseDocument('A\\(x\\)!');
  const mathIndex = items.findIndex(i => i.type === 'math');
  assert.deepEqual(
    [mathBoundaryGaps(items, mathIndex, { policy: 'contextual', fontSize }).left,
      mathBoundaryGaps(items, mathIndex, { policy: 'contextual', fontSize }).right],
    [5, 0]);
  assert.throws(() => compose(src, 480, 'invalid'), /方針/);
});
