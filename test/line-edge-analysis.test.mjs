import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeViolations, inspectStoneLineEdges } from '../public/line-edge-analysis.js';
import { parseDocument } from '../public/document-source.js';

function text(char, sourceOffset) {
  return { type: 'text', char, sourceOffset, endOffset: sourceOffset + char.length };
}
function math(id, start, end) {
  return { type: 'math', id, sourceOffset: start, endOffset: end };
}

test('line-start forbidden punctuation and line-end opening bracket are separately observed', () => {
  const lines = [
    { atoms: [text('あ', 0), text('（', 1)] },
    { atoms: [text('。', 2), text('を', 3)] },
  ];
  const x = edgeViolations(lines, 'あ（。を');
  assert.ok(x.violations.some(v => v.edge === 'end' && v.char === '（'));
  assert.ok(x.violations.some(v => v.edge === 'start' && v.char === '。'));
  assert.equal(x.breaks[0].startOffset, 2);
});

test('math items remain whole source atoms at a line edge', () => {
  const x = edgeViolations([
    { atoms: [text('関', 0), math('math-1', 1, 8)] },
    { atoms: [text('。', 8)] },
  ], '関\\(a+b\\)。');
  assert.equal(x.breaks[0].from, 'math-1');
  assert.equal(x.breaks[0].to, '。');
  assert.ok(x.violations.some(v => v.char === '。' && v.edge === 'start'));
});

test('explicit newline is not counted as soft-line punctuation violation', () => {
  const x = edgeViolations([
    { atoms: [text('文', 0)] },
    { atoms: [text('。', 2)] },
  ], '文\n。');
  assert.equal(x.breaks[0].hard, true);
  assert.equal(x.violations.length, 0);
});

test('Stone source positions follow graphemes and indivisible math markers', () => {
  const items = parseDocument('あ\\(x\\)。');
  const result = {
    status: 'composed', source: 'あ\\(x\\)。',
    runs: [
      { char: 'あ', line: 0 },
      { char: '\u{f0000}', mathId: 'math-1', line: 0 },
      { char: '。', line: 1 },
    ],
  };
  const probe = inspectStoneLineEdges(result, items);
  assert.equal(probe.status, 'composed');
  assert.deepEqual(probe.lines.map(l => l.first), [0, 6]);
  assert.ok(probe.violations.some(v => v.edge === 'start' && v.char === '。'));
});

test('Stone run mismatch never reports a measured legal line', () => {
  const probe = inspectStoneLineEdges({ status: 'composed', runs: [
    { char: 'b', line: 0 },
  ], source: 'a' }, parseDocument('a'));
  assert.equal(probe.status, 'unmatched-run');
  assert.deepEqual(probe.lines, []);
});
