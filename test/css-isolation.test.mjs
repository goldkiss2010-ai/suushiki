import test from 'node:test';
import assert from 'node:assert/strict';
import { groupNeighbors, ISOLATION_VARIANTS } from '../public/css-isolation.js';

test('isolation variants separate text, atomic and MathJax controls', () => {
  assert.equal(ISOLATION_VARIANTS.length, 8);
  assert.equal(new Set(ISOLATION_VARIANTS).size, ISOLATION_VARIANTS.length);
  for (const variant of ['flat-text', 'atomic-box', 'mathjax',
    'atomic-nowrap', 'mathjax-nowrap', 'mathjax-group-box'])
    assert.ok(ISOLATION_VARIANTS.includes(variant));
});

test('group both Japanese brackets around an atomic inline', () => {
  const group = groupNeighbors([
    { kind: 'text', char: 'は' }, { kind: 'text', char: '（' },
    { kind: 'math' }, { kind: 'text', char: '）' },
    { kind: 'text', char: 'で' },
  ], 2);
  assert.deepEqual(group, { start: 1, end: 4 });
});

test('group a formula with a directly following Japanese full stop', () => {
  const group = groupNeighbors([
    { kind: 'text', char: 'で' }, { kind: 'math' },
    { kind: 'text', char: '。' }, { kind: 'text', char: '次' },
  ], 1);
  assert.deepEqual(group, { start: 1, end: 3 });
});

test('ordinary neighbors are never included in the grouping', () => {
  assert.deepEqual(groupNeighbors([
    { kind: 'text', char: '関' }, { kind: 'math' },
    { kind: 'text', char: 'を' },
  ], 1), { start: 1, end: 2 });
});

test('grouping does not proceed without a formula token', () => {
  assert.throws(() => groupNeighbors([{ kind: 'text', char: 'a' }], 0),
    /Expected math token/);
});
