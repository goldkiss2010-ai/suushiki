import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Preserve the research corpus and its links when code changes.
// This is archive maintenance, not a search for additional collisions.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archivePages = [
  'README.md',
  'docs/research/README.md',
  'docs/research/01-kinsoku-atomic-inline.md',
  'docs/research/02-line-height-and-overflow.md',
  'docs/research/03-math-boundary-spacing.md',
  'docs/research/04-source-and-accessibility.md',
  'docs/research/05-method-and-evidence.md',
];

test('Japanese research archive is reachable by relative Markdown links', async () => {
  for (const path of archivePages) {
    const body = await readFile(resolve(root, path), 'utf8');
    assert.ok(body.includes('日本語') || body.includes('数式'),
      'Expected searchable Japanese terms: ' + path);
    const links = [...body.matchAll(/\]\(([^)]+)\)/g)].map(x => x[1]);
    for (const url of links) {
      if (/^(?:https?:|mailto:|#)/.test(url)) continue;
      const target = decodeURIComponent(url.split('#')[0]);
      if (!target) continue;
      const absolute = resolve(root, dirname(path), target);
      assert.ok(absolute.startsWith(root + '/') || absolute === root,
        'Research index should only link within the repository: ' + url);
      await stat(absolute);
    }
  }
});

test('the research record keeps the known seven categories without claiming all are validated', async () => {
  const index = await readFile(resolve(root, 'docs/research/README.md'), 'utf8');
  for (let i = 1; i <= 7; i++) {
    assert.match(index, new RegExp('K0' + i + ' / T0' + i));
  }
  assert.match(index, /未検証/);
  assert.match(index, /新しい衝突/);
});

test('permanent evidence excerpts retain the pinned measurements and limits', async () => {
  const data = JSON.parse(await readFile(resolve(root, 'docs/research/verified-samples.json'), 'utf8'));
  assert.equal(data.schema, 'suushiki/research-evidence-excerpt/1');
  assert.deepEqual(data.provenance.experiments.map(x => x.observations),
    [12, 1026, 2944]);
  assert.equal(data.lineEdgeExamples.length, 5);
  const bracket = data.lineEdgeExamples.find(x => x.id === 'T03b' && x.widthPx === 125);
  assert.equal(bracket.native.issues[0].char, '（');
  assert.equal(bracket.stone.status, 'constraint-conflict');
  assert.equal(bracket.suushiki.status, 'composed');
  assert.deepEqual(bracket.suushiki.issues, []);
  const css = data.cssIsolation;
  assert.equal(css.T03b.find(x => x.variant === 'mathjax').probeIssueWidthCount, 91);
  assert.equal(css.T03b.find(x => x.variant === 'mathjax-nowrap').overflowWidthCount, 18);
  assert.equal(css.T03a.find(x => x.variant === 'mathjax-nowrap').overflowWidthCount, 0);
  assert.ok(data.cautions.some(v => v.includes('fragment count')));
});

test('Japanese research entry points are present in the root README', async () => {
  const readme = await readFile(resolve(root, 'README.md'), 'utf8');
  assert.match(readme, /新しい組版エンジンやサービスの開発ではありません/);
  for (let i = 1; i <= 5; i++) {
    const path = archivePages[i+1];
    assert.ok(readme.includes(path), 'Missing Japanese archive link: ' + path);
  }
});
