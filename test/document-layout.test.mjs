import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedMeasurer } from '@non-standardworld/stone-engine.js';
import { parseDocument, documentSource, MathSourceError, documentExamples } from '../public/document-source.js';
import { layoutDocument } from '../public/document-layout.js';

const options = { fontSize: 20, lineHeightScale: 1.6, punctuationMode: 'stone', kinsoku: true };
function compose(source, overrides = {}) {
  const items = parseDocument(source);
  const math = items.filter(i => i.type === 'math');
  const boxes = new Map(math.map((m, i) => [m.id, { width: 36 + 28 * i, ascent: i % 2 ? 39 : 18, descent: i % 2 ? 49 : 4 }]));
  return layoutDocument({ items, boxes, options, measurer: new FixedMeasurer(), width: 160, ...overrides });
}

test('source parsing preserves spaces, CRLF, escaped delimiters and repeated formula occurrences', () => {
  const source = String.raw`前 \\(literal\\) \(a\)  \(a\)` + '\r\n\r\n  次';
  const items = parseDocument(source);
  assert.equal(documentSource(items), source);
  assert.deepEqual(items.filter(i => i.type === 'math').map(i => [i.id, i.tex]), [['math-1', 'a'], ['math-2', 'a']]);
  for (const item of items) assert.equal(source.slice(item.start, item.end), item.type === 'text' ? item.text : item.raw);
});

test('malformed math reports its position rather than dropping or drawing the source', () => {
  for (const source of [String.raw`\(x`, String.raw`\)`, String.raw`\( \)`, String.raw`\(a \(b\)`]) {
    assert.throws(() => parseDocument(source), MathSourceError);
  }
  assert.throws(() => parseDocument('一行\r\n😀' + String.raw`\(x`), error => error.line === 2 && error.column === 2);
});

test('multiple boxes retain individual sizes, identity and source order at different widths', () => {
  const source = String.raw`最初の式 \(a\) と次の式 \(b\)、最後の式 \(c\)。`;
  const wide = compose(source, { width: 480 });
  const narrow = compose(source);
  assert.equal(wide.status, 'composed');
  assert.equal(narrow.status, 'composed');
  assert.equal(narrow.source, source);
  assert.deepEqual(narrow.geometry.map(g => [g.id, g.width]), [['math-1', 36], ['math-2', 64], ['math-3', 92]]);
  assert.ok(narrow.lineCount > wide.lineCount);
  assert.deepEqual(narrow.runs.filter(r => r.mathId).map(r => r.mathId), ['math-1', 'math-2', 'math-3']);
  assert.deepEqual(narrow.overlaps, []);
});

test('adjacent formulas are distinct indivisible items', () => {
  const result = compose(String.raw`\(a\)\(b\)\(c\)`, { width: 100 });
  assert.equal(result.status, 'composed');
  assert.equal(result.geometry.length, 3);
  assert.deepEqual(result.geometry.map(g => g.width), [36, 64, 92]);
  assert.deepEqual(result.geometry.map(g => g.line), [0, 0, 1]);
});

test('hard breaks and leading, consecutive and trailing blank lines keep their height', () => {
  const source = '\n\n  文' + String.raw`\(x\)` + '\r\n\r\n終\n';
  const result = compose(source, { width: 480, boxes: new Map([['math-1', { width: 36, ascent: 16, descent: 2 }]]) });
  assert.equal(result.status, 'composed');
  assert.equal(result.source, source);
  assert.equal(result.lineCount, 6);
  assert.deepEqual(result.lines.filter(l => l.empty).map(l => l.index), [0, 1, 3, 5]);
  assert.equal(result.renderedSize.height, 192);
  assert.equal(result.runs.filter(r => r.isNewline).map(r => r.char).join(''), '\n\n\r\n\r\n\n');
});

test('repair works across spaces and multiple hard paragraphs without losing any runs', () => {
  const source = String.raw`条件は（ \(a\) ）で与えられる。` + '\n\n' + String.raw`次は（\(b\)）です。`;
  const items = parseDocument(source);
  const boxes = new Map(items.filter(i => i.type === 'math').map(m => [m.id, { width: 104, ascent: 21, descent: 6 }]));
  for (let width = 104; width <= 170; width++) {
    const result = compose(source, { items, boxes, width });
    assert.equal(result.source, source);
    assert.equal(result.geometry.length, 2);
    assert.deepEqual(result.geometry.map(g => g.width), [104, 104]);
    assert.equal(result.runs.filter(r => r.char === ' ').length, 2);
    assert.equal(result.lines.filter(l => l.empty).length, 1);
    if (result.status === 'composed') {
      assert.deepEqual(result.boundaryViolations, []);
      assert.deepEqual(result.horizontalOverflows, []);
    }
    assert.deepEqual(result.overlaps, []);
  }
});

test('Latin word splitting is selectable and an overwide word reports unmet constraints', () => {
  const source = 'English abcdefghijklmnopqrstuvwxyz 終わり';
  const kept = compose(source, { width: 100 });
  const divided = compose(source, { width: 100, wordPolicy: 'break' });
  assert.equal(kept.status, 'constraint-conflict');
  assert.ok(kept.wordSplits.length > 0);
  assert.equal(divided.status, 'composed');
  assert.equal(divided.source, source);
});

test('an oversized occurrence withholds the whole drawing while retaining every expression', () => {
  const result = compose(String.raw`\(a\) と \(b\) と \(c\)`, { width: 80 });
  assert.equal(result.status, 'unsatisfied-width');
  assert.equal(result.displayAllowed, false);
  assert.deepEqual(result.oversized, [{ id: 'math-3', requiredWidth: 92 }]);
  assert.equal(result.items.filter(i => i.type === 'math').length, 3);
});

test('empty source produces one empty line and fixed tall lines report distant overlaps', () => {
  const empty = compose('');
  assert.equal(empty.status, 'composed');
  assert.equal(empty.lineCount, 1);
  assert.equal(empty.renderedSize.height, 32);
  const fixed = compose(String.raw`\(a\)` + '\n' + String.raw`\(b\)` + '\n文\n文', { policy: 'fixed' });
  assert.ok(fixed.overlaps.some(([a, b]) => b - a > 1));
});

test('ordinary long text does not trigger an exhaustive repair search', () => {
  const source = '普通の文章と English words を並べる。\n\n'.repeat(80);
  const result = compose(source, { width: 480 });
  assert.equal(result.source, source);
  assert.equal(result.status, 'composed');
  assert.ok(result.candidateCount < 20000);
  assert.ok(result.runs.length > 200);
});

test('all shipped examples preserve their original source', () => {
  for (const source of Object.values(documentExamples)) assert.equal(documentSource(parseDocument(source)), source);
});
