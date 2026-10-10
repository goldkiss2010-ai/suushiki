import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedMeasurer } from '@non-standardworld/stone-engine.js';
import { layoutInlineBox, inlineBoxSvg } from '../public/inline-box.js';

const compose = overrides => layoutInlineBox({
  before: '式の位置を確認する。ここに',
  after: 'を置き、（括弧）と句読点の折り返しを観察します。次の行も確認します。',
  box: { id: 'test-box', width: 104, ascent: 39, descent: 49 }, width: 480,
  options: { fontSize: 20, lineHeightScale: 1.6 }, measurer: new FixedMeasurer(), ...overrides,
});

test('narrow layout moves a whole box to a later line without changing its width', () => {
  const wide = compose();
  const narrow = compose({ width: 160 });
  assert.ok(narrow.geometry.line > wide.geometry.line);
  assert.equal(narrow.geometry.width, 104);
  assert.equal(narrow.runs.filter(run => run.char === '\uFFFC').length, 1);
  assert.equal(narrow.source[1].id, 'test-box');
  assert.equal(narrow.runs.filter(run => run.char !== '\uFFFC').map(run => run.char).join(''),
    narrow.source[0].text + narrow.source[2].text);
});

test('content-aware lines separate a tall box from neighbouring lines', () => {
  const result = compose({ width: 160 });
  assert.deepEqual(result.overlaps, []);
  for (let i = 1; i < result.lines.length; i++) {
    assert.ok(result.lines[i].top >= result.lines[i - 1].bottom);
  }
  assert.equal(result.geometry.baseline - result.geometry.y, 39);
  assert.equal(result.geometry.y + result.geometry.height - result.geometry.baseline, 49);
  assert.ok(result.renderedSize.height >= result.geometry.y + result.geometry.height);
});

test('fixed line advance reports the tall box collision', () => {
  const pairs = compose({ width: 160, policy: 'fixed' }).overlaps;
  assert.ok(pairs.length > 0);
  assert.ok(pairs.some(([a, b]) => b - a > 1), 'tall box can also reach beyond the neighbouring line');
});

test('an oversized box is reported with its source intact', () => {
  const result = compose({ width: 100 });
  assert.equal(result.status, 'unsatisfied-width');
  assert.equal(result.requiredWidth, 104);
  assert.equal(result.source[1].id, 'test-box');
  assert.equal(inlineBoxSvg(result), '');
});

test('the SVG draws one measured box and does not emit a placeholder glyph', () => {
  const result = compose();
  const svg = inlineBoxSvg(result);
  assert.equal((svg.match(/data-inline-box=/g) || []).length, 1);
  assert.ok(!svg.includes('\uFFFC'));
  assert.ok(svg.includes(`width="${result.geometry.width}" height="${result.geometry.height}"`));
  assert.equal(result.ctx.isTruncated, false);
});
