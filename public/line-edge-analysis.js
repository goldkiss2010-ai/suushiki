// Experimental line-edge observations, NOT a JLREQ conformance oracle.
// Stone's exported punctuation sets are applied to both compositions solely
// as the same declared probe policy. CSS may legitimately choose another policy.
import { isNotStartingChar, isNotEndingChar, isInseparablePair } from '@non-standardworld/stone-engine.js';

const SEGMENTER = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const BASELINE_EPS = 2.5;

export function edgeViolations(lines, source = '') {
  const violations = [], breaks = [];
  for (const [index, line] of lines.entries()) {
    const first = line.atoms[0], last = line.atoms.at(-1);
    if (!first || !last) continue;
    const precededByHardBreak = index > 0 && source.slice(lines[index - 1].atoms.at(-1).endOffset,
      first.sourceOffset).includes('\n');
    if (first.type === 'text' && isNotStartingChar(first.char) && !precededByHardBreak)
      violations.push({ line: index, edge: 'start', char: first.char, offset: first.sourceOffset });
    if (last.type === 'text' && isNotEndingChar(last.char))
      violations.push({ line: index, edge: 'end', char: last.char, offset: last.sourceOffset });
    if (index > 0) {
      const before = lines[index - 1].atoms.at(-1);
      if (!before) continue;
      const isHardBreak = source.slice(before.endOffset, first.sourceOffset).includes('\n');
      const entry = {
        line: index, from: before.type === 'math' ? before.id : before.char,
        to: first.type === 'math' ? first.id : first.char,
        startOffset: first.sourceOffset, hard: isHardBreak,
      };
      breaks.push(entry);
      if (!isHardBreak && before.type === 'text' && first.type === 'text' &&
          isInseparablePair(before.char, first.char))
        violations.push({ line: index, edge: 'pair', char: before.char + first.char,
          offset: first.sourceOffset });
    }
  }
  return { violations, breaks };
}

function toRuns(items) {
  const sourceAtoms = [];
  for (const item of items) {
    if (item.type === 'math') {
      sourceAtoms.push({ type: 'math', id: item.id, sourceOffset: item.start, endOffset: item.end });
    } else {
      for (const { segment, index } of SEGMENTER.segment(item.text))
        sourceAtoms.push({ type: 'text', char: segment, sourceOffset: item.start + index,
          endOffset: item.start + index + segment.length });
    }
  }
  return sourceAtoms;
}

export function inspectStoneLineEdges(result, items) {
  if (!result.runs) return { status: result.status, lines: [], violations: [], breaks: [] };
  const units = toRuns(items);
  const runs = result.runs;
  if (runs.length !== units.length)
    return { status: 'unmatched-run-count', expected: units.length, actual: runs.length,
      lines: [], violations: [], breaks: [] };
  const lines = new Map();
  for (const [index, run] of runs.entries()) {
    const atom = units[index];
    if (atom.type === 'math' ? run.mathId !== atom.id :
        run.char !== atom.char) {
      return { status: 'unmatched-run', index, lines: [], violations: [], breaks: [] };
    }
    if (run.isNewline || (atom.type === 'text' && !atom.char.trim())) continue;
    if (!lines.has(run.line)) lines.set(run.line, []);
    lines.get(run.line).push(atom);
  }
  const entries = [...lines.entries()].sort((a, b) => a[0] - b[0])
    .map(([line, atoms]) => ({ line, atoms }));
  return { status: result.status, lines: entries.map(({ line, atoms }) => ({
    line, first: atoms[0].sourceOffset, last: atoms.at(-1).sourceOffset,
  })), ...edgeViolations(entries, result.source) };
}

function textBaselineOffset(root) {
  const probe = document.createElement('span');
  Object.assign(probe.style, {
    position: 'absolute', left: '0', top: '0', visibility: 'hidden', whiteSpace: 'nowrap',
    font: getComputedStyle(root).font, lineHeight: '1.6',
  });
  const text = document.createTextNode('あ');
  const zero = document.createElement('span');
  Object.assign(zero.style, { display: 'inline-block', width: '0', height: '0',
    verticalAlign: 'baseline' });
  probe.append(text, zero);
  root.append(probe);
  try {
    const range = document.createRange();
    range.selectNodeContents(text);
    return zero.getBoundingClientRect().top - range.getBoundingClientRect().top;
  } finally { probe.remove(); }
}

// Actual browser text position is measured via Range per grapheme. For
// MathJax's atomic SVG, measured ascent identifies its shared text baseline.
// Skip multi-fragment math rather than inventing a single line assignment.
export function inspectNativeLineEdges(root, items, mathBoxes) {
  const origin = root.getBoundingClientRect();
  const baselineOffset = textBaselineOffset(root);
  const atoms = [];
  for (const span of root.querySelectorAll('[data-native-text-start]')) {
    const node = span.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) continue;
    const start = Number(span.dataset.nativeTextStart);
    for (const { segment, index } of SEGMENTER.segment(node.data)) {
      if (!segment.trim() || /[\r\n]/u.test(segment)) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + segment.length);
      const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
      if (rects.length !== 1) return { status: 'unmatched-text-fragments', lines: [],
        breaks: [], violations: [] };
      const rect = rects[0];
      atoms.push({ type: 'text', char: segment, sourceOffset: start + index,
        endOffset: start + index + segment.length,
        baseline: rect.top + baselineOffset - origin.top });
    }
  }
  const mathById = new Map(items.filter(i => i.type === 'math').map(i => [i.id, i]));
  for (const container of root.querySelectorAll('[data-native-math]')) {
    const id = container.dataset.nativeMath;
    const item = mathById.get(id), metrics = mathBoxes.get(id);
    const svgs = container.querySelectorAll('svg');
    if (!item || !metrics || svgs.length !== 1) return {
      status: 'unmatched-math-fragments', lines: [], breaks: [], violations: [],
    };
    atoms.push({ type: 'math', id, sourceOffset: item.start, endOffset: item.end,
      baseline: svgs[0].getBoundingClientRect().top - origin.top + metrics.ascent });
  }
  const grouped = [];
  for (const atom of atoms.sort((a, b) => a.baseline - b.baseline || a.sourceOffset - b.sourceOffset)) {
    let row = grouped.find(row => Math.abs(row.baseline - atom.baseline) < BASELINE_EPS);
    if (!row) { row = { baseline: atom.baseline, atoms: [] }; grouped.push(row); }
    row.atoms.push(atom);
  }
  const lines = grouped.sort((a, b) => a.baseline - b.baseline)
    .map((line, index) => ({
      line: index, baseline: Number(line.baseline.toFixed(3)),
      atoms: line.atoms.sort((a, b) => a.sourceOffset - b.sourceOffset),
    }));
  // Source-offset monotonicity is required for a meaningful paragraph edge.
  for (let i = 1; i < lines.length; i++) if (
    lines[i - 1].atoms.at(-1).sourceOffset >= lines[i].atoms[0].sourceOffset
  ) return { status: 'ambiguous-line-order', lines: [], breaks: [], violations: [] };
  const source = items.map(item => item.type === 'math' ? item.raw : item.text).join('');
  const analyzed = edgeViolations(lines, source);
  return {
    status: 'measured', baselineOffset: Number(baselineOffset.toFixed(3)),
    lines: lines.map(l => ({
      line: l.line, baseline: l.baseline,
      first: l.atoms[0].sourceOffset, last: l.atoms.at(-1).sourceOffset,
      start: l.atoms[0].type === 'math' ? '[math]' : l.atoms[0].char,
      end: l.atoms.at(-1).type === 'math' ? '[math]' : l.atoms.at(-1).char,
    })),
    ...analyzed,
  };
}
