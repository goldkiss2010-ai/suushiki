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

test('a fitting box with an unfittable following full stop reports a boundary conflict', () => {
  const narrow = compose({ before: '説明の後で', after: '。次の条件を考える。', width: 104 });
  assert.equal(narrow.status, 'constraint-conflict');
  assert.ok(narrow.boundaryViolations.some(v => v.edge === 'start' && v.char === '。'));
  assert.equal(narrow.ctx.isTruncated, false);
  const wide = compose({ before: '説明の後で', after: '。次の条件を考える。', width: 160 });
  assert.equal(wide.status, 'composed');
  assert.deepEqual(wide.boundaryViolations, []);
});

test('opening and closing brackets around an atomic box are checked at line edges', () => {
  const narrow = compose({ before: '条件は（', after: '）で与えられる。', width: 104 });
  assert.equal(narrow.status, 'constraint-conflict');
  assert.ok(narrow.boundaryViolations.some(v => v.edge === 'end' && v.char === '（'));
  assert.ok(narrow.boundaryViolations.some(v => v.edge === 'start' && v.char === '）'));
  assert.ok(inlineBoxSvg(narrow).includes('data-inline-box'));
  const wide = compose({ before: '条件は（', after: '）で与えられる。', width: 160 });
  assert.equal(wide.status, 'composed');
});

test('each single-pixel boundary is either legal or explicitly reported', () => {
  for (const [before, after] of [['説明の後で', '。次の条件を考える。'], ['条件は（', '）で与えられる。']]) {
    for (let width = 104; width <= 260; width++) {
      const result = compose({ before, after, width });
      const illegalEdges = result.lines.flatMap(line => {
        const chars = result.runs.filter(r => r.line === line.index && !r.isNewline && r.char.trim()).map(r => r.char);
        return [['start', chars[0]], ['end', chars.at(-1)]].filter(([edge, char]) =>
          edge === 'start' ? ['。', '）'].includes(char) : char === '（')
          .map(([edge, char]) => ({ line: line.index, edge, char }));
      });
      assert.deepEqual(result.boundaryViolations, illegalEdges);
      assert.equal(result.status, illegalEdges.length ? 'constraint-conflict' : 'composed');
      assert.equal(result.ctx.isTruncated, false);
      assert.equal(result.geometry.width, 104);
      assert.equal(result.runs.filter(r => r.char !== '\uFFFC').map(r => r.char).join(''), before + after);
    }
  }
});
