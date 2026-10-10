import { layoutText, isNotStartingChar, isNotEndingChar, isInseparablePair } from '@non-standardworld/stone-engine.js';
import { documentSource } from './document-source.js';
import { mathBoundaryGaps, BOUNDARY_POLICIES } from './math-boundary.js';

const EPS = 1e-6;
const LATIN_WORD = /^[\p{Script=Latin}\p{N}\p{M}'’_-]+$/u;

function validateBox(box) {
  if (!box || [box.width, box.ascent, box.descent].some(v => !Number.isFinite(v) || v < 0) ||
      box.width === 0 || box.ascent + box.descent === 0) throw new Error('数式の寸法が不正です。');
}

function diagnostics(runs, kinsoku, wordPolicy, width) {
  const byLine = new Map(), words = new Map();
  for (const run of runs) {
    if (!byLine.has(run.line)) byLine.set(run.line, []);
    byLine.get(run.line).push(run);
    if (run.wordId !== undefined) {
      if (!words.has(run.wordId)) words.set(run.wordId, { word: '', lines: new Set() });
      const w = words.get(run.wordId);
      w.word += run.char;
      w.lines.add(run.line);
    }
  }
  const boundaryViolations = [];
  if (kinsoku) for (const [line, all] of byLine) {
    const visible = all.filter(r => !r.isNewline && r.char.trim());
    if (!visible.length) continue;
    if (isNotStartingChar(visible[0].char)) boundaryViolations.push({ line, edge: 'start', char: visible[0].char });
    if (isNotEndingChar(visible.at(-1).char)) boundaryViolations.push({ line, edge: 'end', char: visible.at(-1).char });
  }
  const wordSplits = wordPolicy === 'preserve' ? [...words.values()].filter(w => w.lines.size > 1)
    .map(w => ({ word: w.word, lines: [...w.lines] })) : [];
  const horizontalOverflows = runs.filter(r => {
    const f = r.advanceFrame ?? r.frame;
    return !r.isNewline && (f.x < -EPS || f.x + f.width > width + EPS);
  }).map(r => {
    const f = r.advanceFrame ?? r.frame;
    return { line: r.line, char: r.char, mathId: r.mathId, left: f.x, right: f.x + f.width };
  });
  return { boundaryViolations, wordSplits, horizontalOverflows };
}

function hasConflict(d) { return d.boundaryViolations.length || d.wordSplits.length || d.horizontalOverflows.length; }

function groupsFor(runs, kinsoku, wordPolicy) {
  // Significant neighbours skip spaces but never cross a hard line break.
  const before = [], after = [];
  let previous;
  for (let i = 0; i < runs.length; i++) {
    before[i] = previous;
    if (runs[i].char.trim()) previous = runs[i];
  }
  let next;
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].char.trim()) next = runs[i];
    after[i] = next;
  }
  const groups = [];
  let start = 0;
  for (let i = 1; i < runs.length; i++) {
    const a = before[i], b = after[i];
    const prohibited = kinsoku && ((a && isNotEndingChar(a.char)) || (b && isNotStartingChar(b.char)) ||
      (a && b && isInseparablePair(a.char, b.char)));
    const sameWord = wordPolicy === 'preserve' && runs[i - 1].wordId !== undefined && runs[i - 1].wordId === runs[i].wordId;
    if (!prohibited && !sameWord) { groups.push({ start, end: i }); start = i; }
  }
  if (runs.length) groups.push({ start, end: runs.length });
  return groups;
}

function repairPart(runs, layout, width, kinsoku, wordPolicy, budget, markers) {
  const groups = groupsFor(runs, kinsoku, wordPolicy);
  const lines = [];
  let start = 0, end = 0, measured;
  const measure = (a, b) => {
    if (--budget.remaining < 0) return null;
    budget.candidates++;
    const first = runs[a]?.char, last = runs[b - 1]?.char;
    const override = new Map();
    // A soft line edge has no neighbour outside the line: retract the
    // generated margin from that edge *before* checking line fit.
    if (markers.has(first)) {
      const m = markers.get(first);
      override.set(first, m.width + m.rightGap - (first === last ? m.rightGap : 0));
    }
    if (markers.has(last)) {
      const m = markers.get(last);
      override.set(last, m.width + m.leftGap - (first === last ? m.leftGap : 0));
    }
    if (first === last && markers.has(first)) override.set(first, markers.get(first).width);
    const ctx = layout(runs.slice(a, b).map(r => r.char).join('') + '\n', Infinity, override);
    const candidate = ctx.runs.filter(r => !r.isNewline);
    for (const [i, run] of candidate.entries()) if (markers.has(run.char)) {
      const m = markers.get(run.char);
      run.mathPaddingLeft = i === 0 ? 0 : m.leftGap;
      run.mathPaddingRight = i === candidate.length - 1 ? 0 : m.rightGap;
    }
    const fits = !ctx.isTruncated && candidate.length === b - a && candidate.every(r =>
      r.line === 0 && r.frame.x >= -EPS && r.frame.x + r.frame.width <= width + EPS);
    return { runs: candidate, fits };
  };
  for (const group of groups) {
    let candidate = measure(start, group.end);
    if (!candidate) return { applied: false, reason: 'work-limit' };
    if (!candidate.fits && measured) {
      lines.push({ start, end, runs: measured });
      start = group.start;
      candidate = measure(start, group.end);
      if (!candidate) return { applied: false, reason: 'work-limit' };
    }
    if (!candidate.fits) return { applied: false, reason: 'group-too-wide',
      group: runs.slice(group.start, group.end).map(r => r.mathId ? { mathId: r.mathId } : r.char) };
    end = group.end;
    measured = candidate.runs;
  }
  if (measured) lines.push({ start, end, runs: measured });
  return { applied: true, lines };
}

export function layoutDocument({ items, boxes = new Map(), width, options = {}, measurer,
  policy = 'adaptive', boundaryPolicy = 'repair', conflictPolicy = 'inspect', wordPolicy = 'preserve',
  boundarySpacing = 'none' }) {
  if (!Number.isFinite(width) || width <= 0) throw new Error('組版幅が不正です。');
  if (!['adaptive', 'fixed'].includes(policy) || !['repair', 'stone'].includes(boundaryPolicy) ||
      !['inspect', 'withhold'].includes(conflictPolicy) || !['preserve', 'break'].includes(wordPolicy) ||
      !BOUNDARY_POLICIES.includes(boundarySpacing)) throw new Error('組版方針が不正です。');
  const source = documentSource(items);
  const markers = new Map(), mathItems = [], ids = new Set();
  let codePoint = 0xf0000;
  const encoded = items.map((item, index) => {
    if (item.type === 'text') return item.text;
    if (ids.has(item.id)) throw new Error('数式の識別子が重複しています。');
    ids.add(item.id);
    const box = boxes.get(item.id);
    validateBox(box);
    let marker;
    do { marker = String.fromCodePoint(codePoint++); } while (source.includes(marker));
    const boundary = mathBoundaryGaps(items, index, { policy: boundarySpacing, fontSize: options.fontSize ?? 20 });
    markers.set(marker, { ...item, ...box, id: item.id, leftGap: boundary.left, rightGap: boundary.right,
      boundary, advanceWidth: box.width + boundary.left + boundary.right });
    mathItems.push({ ...item, width: box.width, ascent: box.ascent, descent: box.descent });
    return marker;
  }).join('');
  const resultBase = { source, items, mathItems, policy, boundaryPolicy, conflictPolicy, wordPolicy, boundarySpacing };
  const oversized = mathItems.filter(m => m.width > width).map(m => ({ id: m.id, requiredWidth: m.width }));
  if (oversized.length) return { ...resultBase, status: 'unsatisfied-width', displayAllowed: false, availableWidth: width, oversized };
  const resolved = { ...options, direction: 'lrTb', textAlign: 'leading', directionAlign: 'start',
    adjustsFontSizeToFitWidth: false, minimumScaleFactor: 0 };
  const layout = (text, availableWidth, overrides = new Map()) => layoutText(text, resolved, {
    advance: (font, size, char) => markers.has(char) ?
      (overrides.get(char) ?? markers.get(char).advanceWidth) : measurer.advance(font, size, char),
    metrics: (font, size) => measurer.metrics(font, size),
  }, { width: availableWidth });
  const ctx = layout(encoded, width);
  for (const token of ctx.tokens) {
    const runs = ctx.runs.slice(token.start, token.end);
    const text = runs.map(r => r.char).join('');
    if (LATIN_WORD.test(text) && /[\p{Script=Latin}\p{N}]/u.test(text)) for (const run of runs) run.wordId = token.start;
  }
  for (const run of ctx.runs) if (markers.has(run.char)) {
    const box = markers.get(run.char);
    run.mathId = box.id;
    run.mathPaddingLeft = box.leftGap;
    run.mathPaddingRight = box.rightGap;
  }
  const kinsoku = options.kinsoku !== false;
  const parts = [{ runs: [], newline: null }];
  for (const run of ctx.runs) {
    if (run.isNewline) { parts.at(-1).newline = run; parts.push({ runs: [], newline: null }); }
    else parts.at(-1).runs.push(run);
  }
  const budget = { remaining: 20000, candidates: 0 };
  const repairs = [];
  let lineOffset = 0;
  for (const [partIndex, part] of parts.entries()) {
    const initial = diagnostics(part.runs, kinsoku, wordPolicy, width);
    let repaired;
    if (boundaryPolicy === 'repair' && (hasConflict(initial) ||
        (boundarySpacing !== 'none' && part.runs.some(r => r.mathId)))) {
      repaired = repairPart(part.runs, layout, width, kinsoku, wordPolicy, budget, markers);
      const { lines, ...entry } = repaired;
      repairs.push({ part: partIndex, ...entry });
    }
    let lineCount;
    if (repaired?.applied) {
      for (const [localLine, line] of repaired.lines.entries()) for (let i = line.start; i < line.end; i++) {
        const target = part.runs[i], measured = line.runs[i - line.start];
        const index = lineOffset + localLine;
        target.position = { ...measured.position, y: measured.position.y + index * ctx.adjustLineHeight };
        target.frame = { ...measured.frame, y: measured.frame.y + index * ctx.adjustLineHeight };
        target.fontId = measured.fontId;
        if (target.mathId) {
          target.mathPaddingLeft = measured.mathPaddingLeft;
          target.mathPaddingRight = measured.mathPaddingRight;
        }
        target.line = index;
        target.visibility = 'visible';
      }
      lineCount = Math.max(1, repaired.lines.length);
    } else {
      const first = part.runs[0]?.line ?? part.newline?.line ?? 0;
      lineCount = part.runs.length ? part.runs.at(-1).line - first + 1 : 1;
      for (const run of part.runs) {
        const delta = lineOffset - first;
        run.line += delta;
        run.position.y += delta * ctx.adjustLineHeight;
        run.frame.y += delta * ctx.adjustLineHeight;
      }
    }
    if (part.newline) {
      const index = lineOffset + lineCount - 1;
      const delta = index - part.newline.line;
      part.newline.line = index;
      part.newline.position.y += delta * ctx.adjustLineHeight;
      part.newline.frame.y += delta * ctx.adjustLineHeight;
    }
    lineOffset += lineCount;
  }
  ctx.lineCount = lineOffset;
  if (ctx.isTruncated) return { ...resultBase, status: 'unsatisfied-layout', displayAllowed: false,
    reason: 'Stone returned hidden or ellipsis runs', repairs };
  for (const run of ctx.runs) if (run.mathId) {
    const box = markers.get(run.char);
    // Advance and visible box are different: only the latter is painted.
    run.advanceFrame = { ...run.frame };
    run.frame = { x: run.advanceFrame.x + run.mathPaddingLeft,
      y: run.position.y - box.ascent, width: box.width, height: box.ascent + box.descent };
  }
  const byLine = Array.from({ length: ctx.lineCount }, () => []);
  for (const run of ctx.runs) byLine[run.line].push(run);
  const gap = Math.max(0, ctx.adjustLineGapHeight), lines = [];
  let cursor = 0;
  const fallbackAscent = ctx.fontManager.ascent(1, ctx.adjustFontSize);
  const fallbackDescent = ctx.adjustFontSize - fallbackAscent;
  for (let index = 0; index < ctx.lineCount; index++) {
    const runs = byLine[index];
    const empty = !runs.some(r => !r.isNewline && r.char.trim());
    const oldBaseline = runs[0]?.position.y ?? gap / 2 + fallbackAscent + index * ctx.adjustLineHeight;
    const ascent = empty ? fallbackAscent : Math.max(...runs.map(r => oldBaseline - r.frame.y));
    const descent = empty ? fallbackDescent : Math.max(...runs.map(r => r.frame.y + r.frame.height - oldBaseline));
    const baseline = policy === 'adaptive' ? cursor + gap / 2 + ascent : oldBaseline;
    for (const run of runs) { run.position.y += baseline - oldBaseline; run.frame.y += baseline - oldBaseline; }
    lines.push({ index, baseline, ascent, descent, top: baseline - ascent, bottom: baseline + descent, empty });
    cursor += ascent + descent + gap;
  }
  const shift = Math.max(0, -Math.min(...lines.map(l => l.top)));
  if (shift) {
    for (const run of ctx.runs) { run.position.y += shift; run.frame.y += shift; }
    for (const line of lines) { line.baseline += shift; line.top += shift; line.bottom += shift; }
  }
  // Sweep by top edge: detect nonadjacent overlaps without comparing every pair.
  const overlaps = [];
  let active = [];
  for (const line of [...lines].sort((a, b) => a.top - b.top)) {
    active = active.filter(other => other.bottom > line.top + EPS);
    for (const other of active) if (line.bottom > other.top + EPS) overlaps.push([Math.min(other.index, line.index), Math.max(other.index, line.index)]);
    active.push(line);
  }
  const d = diagnostics(ctx.runs, kinsoku, wordPolicy, width);
  const geometry = ctx.runs.filter(r => r.mathId).map(run => {
    const box = markers.get(run.char);
    return { id: run.mathId, tex: box.tex, x: run.frame.x, y: run.frame.y, width: box.width,
      height: box.ascent + box.descent, ascent: box.ascent, descent: box.descent, baseline: run.position.y, line: run.line,
      boundary: { policy: boundarySpacing, requestedLeft: box.leftGap, requestedRight: box.rightGap,
        appliedLeft: run.mathPaddingLeft, appliedRight: run.mathPaddingRight,
        sourceBefore: box.boundary.before, sourceAfter: box.boundary.after } };
  });
  ctx.renderedSize = { width: Math.max(0, ...ctx.runs.map(r => r.frame.x + r.frame.width)),
    height: Math.max(...lines.map(l => l.bottom)) + gap / 2 };
  const repairFailures = repairs.filter(r => !r.applied);
  const conflict = !!hasConflict(d) || repairFailures.length > 0;
  return { ...resultBase, status: conflict ? 'constraint-conflict' : 'composed',
    displayAllowed: !conflict || conflictPolicy === 'inspect', repairs, candidateCount: budget.candidates,
    geometry, lines, overlaps, repairFailures, ...d, lineCount: ctx.lineCount, renderedSize: ctx.renderedSize,
    runs: ctx.runs, ctx };
}
