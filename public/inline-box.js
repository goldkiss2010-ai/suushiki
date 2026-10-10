import { layoutText, svgString, isNotStartingChar, isNotEndingChar } from '@non-standardworld/stone-engine.js';

// Experimental adapter: one object-replacement grapheme participates in Stone's
// horizontal line breaking; its source identity and geometry remain separate.
const MARKER = '\uFFFC';
export function layoutInlineBox({ before, after, box, width, options, measurer, policy = 'adaptive' }) {
  if (before.includes(MARKER) || after.includes(MARKER)) throw new Error('入力に予約済みの置換文字が含まれています。');
  if (!['adaptive', 'fixed'].includes(policy)) throw new Error('Unknown line policy');
  for (const value of [width, box.width, box.ascent, box.descent]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Box dimensions must be finite and nonnegative');
  }
  if (width === 0 || box.width === 0 || box.ascent + box.descent === 0) throw new Error('Empty layout dimensions');
  const source = [{ type: 'text', text: before }, { type: 'box', ...box }, { type: 'text', text: after }];
  // A wider-than-column object cannot satisfy the selected nonbreaking policy.
  // Keep the source and report it rather than silently splitting or clipping it.
  if (box.width > width) return { source, status: 'unsatisfied-width', requiredWidth: box.width, availableWidth: width };
  const ctx = layoutText(before + MARKER + after, {
    ...options, direction: 'lrTb', textAlign: 'leading', directionAlign: 'start',
    adjustsFontSizeToFitWidth: false, minimumScaleFactor: 0,
  }, {
    advance: (font, size, char) => char === MARKER ? box.width : measurer.advance(font, size, char),
    metrics: (font, size) => measurer.metrics(font, size),
  }, { width });
  const object = ctx.runs.find(run => run.char === MARKER);
  if (!object) throw new Error('数式の置換文字が見つかりませんでした。');
  if (ctx.isTruncated) return { source, status: 'unsatisfied-layout', reason: 'Stone returned hidden or ellipsis runs' };
  object.frame = { x: object.frame.x, y: object.position.y - box.ascent,
    width: box.width, height: box.ascent + box.descent };
  const lines = [];
  const gap = Math.max(0, ctx.adjustLineGapHeight);
  let cursor = 0;
  for (let index = 0; index < ctx.lineCount; index++) {
    const runs = ctx.runs.filter(run => run.line === index);
    const oldBaseline = runs[0].position.y;
    const ascent = Math.max(...runs.map(run => oldBaseline - run.frame.y));
    const descent = Math.max(...runs.map(run => run.frame.y + run.frame.height - oldBaseline));
    const baseline = policy === 'adaptive' ? cursor + gap / 2 + ascent : oldBaseline;
    for (const run of runs) {
      run.position.y += baseline - oldBaseline;
      run.frame.y += baseline - oldBaseline;
    }
    lines.push({ index, baseline, ascent, descent, top: baseline - ascent, bottom: baseline + descent });
    cursor += ascent + descent + gap;
  }
  // A fixed line advance can put a tall first item above the canvas. Translate
  // the entire paragraph, preserving relative line positions and any collisions.
  const shift = Math.max(0, -Math.min(...lines.map(line => line.top)));
  for (const run of ctx.runs) { run.position.y += shift; run.frame.y += shift; }
  for (const line of lines) { line.baseline += shift; line.top += shift; line.bottom += shift; }
  const overlaps = lines.flatMap((line, i) => lines.slice(i + 1)
    .filter(other => line.bottom > other.top + 1e-6 && other.bottom > line.top + 1e-6)
    .map(other => [line.index, other.index]));
  const geometry = { x: object.frame.x, y: object.frame.y, width: box.width,
    height: box.ascent + box.descent, baseline: object.position.y, line: object.line,
    ascent: box.ascent, descent: box.descent };
  ctx.renderedSize = { width: Math.max(...ctx.runs.map(run => run.frame.x + run.frame.width)),
    height: Math.max(...lines.map(line => line.bottom)) + gap / 2 };
  const boundaryViolations = [];
  if (options.kinsoku !== false) for (const line of lines) {
    const runs = ctx.runs.filter(run => run.line === line.index && !run.isNewline && run.char.trim());
    if (!runs.length) continue;
    if (isNotStartingChar(runs[0].char)) boundaryViolations.push({ line: line.index, edge: 'start', char: runs[0].char });
    if (isNotEndingChar(runs.at(-1).char)) boundaryViolations.push({ line: line.index, edge: 'end', char: runs.at(-1).char });
  }
  const horizontalOverflows = ctx.runs.filter(run => run.frame.x < -1e-6 || run.frame.x + run.frame.width > width + 1e-6)
    .map(run => ({ line: run.line, char: run.char, left: run.frame.x, right: run.frame.x + run.frame.width }));
  return { source, status: boundaryViolations.length || horizontalOverflows.length ? 'constraint-conflict' : 'composed',
    policy, geometry, lines, overlaps, boundaryViolations, horizontalOverflows,
    lineCount: ctx.lineCount, renderedSize: ctx.renderedSize, runs: ctx.runs, ctx };
}

export function inlineBoxSvg(result, showFrames = true) {
  if (!result.ctx) return '';
  // Suppression belongs to rendering: keep the layout context and exported runs
  // visible so Stone's isTruncated does not misreport the replaced object.
  const object = result.ctx.runs.find(run => run.char === MARKER);
  const visibility = object.visibility;
  let svg;
  try {
    object.visibility = 'invisible';
    svg = svgString(result.ctx, { showFrames });
  } finally { object.visibility = visibility; }
  const b = result.geometry;
  const guides = result.lines.map(line => `<line x1="0" x2="${result.ctx.renderSize.width}" y1="${line.baseline}" y2="${line.baseline}" stroke="#3977ca" stroke-width="0.6"/>`).join('');
  return svg.replace('</svg>', `${guides}<rect data-inline-box="true" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#e6f0fc" stroke="#3977ca"/><line x1="${b.x}" x2="${b.x + b.width}" y1="${b.baseline}" y2="${b.baseline}" stroke="#c83939"/></svg>`);
}

export function mountInlineMath(result, measuredSvg, { showFrames = true, fontSize, family } = {}) {
  if (!result.ctx) return null;
  const template = document.createElement('template');
  template.innerHTML = inlineBoxSvg(result, showFrames);
  const textSvg = template.content.firstElementChild;
  const rectangle = textSvg.querySelector('[data-inline-box]');
  if (showFrames) {
    rectangle.setAttribute('fill', 'none');
    rectangle.setAttribute('data-math-frame', 'true');
    rectangle.removeAttribute('data-inline-box');
  } else rectangle.remove();
  const output = document.createElement('div');
  output.dataset.mathParagraph = 'true';
  output.style.position = 'relative';
  output.style.width = `${result.ctx.renderSize.width}px`;
  const b = result.geometry;
  const math = measuredSvg.cloneNode(true);
  math.setAttribute('width', b.width);
  math.setAttribute('height', b.height);
  math.setAttribute('data-inline-math', 'true');
  Object.assign(math.style, { position: 'absolute', display: 'block',
    left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px`,
    verticalAlign: '', fontSize: `${fontSize}px`, fontFamily: family });
  // Keep MathJax as a root SVG viewport. A nested SVG's bounding client rect
  // describes its drawn contents rather than the root viewport measured above.
  output.append(textSvg, math);
  return output;
}
