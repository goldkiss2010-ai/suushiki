// CSS-only controls for a single inline MathJax formula. This laboratory
// constructs distinct DOM variants from the same surrounding Japanese source,
// without changing SUUSHIKI's editor or committing to a new renderer.
// It is *not* a user-facing typesetting implementation.
import { parseDocument } from './document-source.js';
import { inspectNativeLineEdges } from './line-edge-analysis.js';

const SEGMENTER = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const OPEN = new Set(['（', '「', '『', '(', '［', '【']);
const CLOSE = new Set(['）', '」', '』', ')', '］', '】', '、', '。']);
const VARIANTS = [
  'flat-text', 'inline-text', 'atomic-box', 'mathjax',
  'atomic-nowrap', 'mathjax-nowrap',
  'atomic-group-box', 'mathjax-group-box',
];
export const ISOLATION_VARIANTS = Object.freeze(VARIANTS);

export function groupNeighbors(tokens, mathIndex) {
  if (!tokens[mathIndex] || tokens[mathIndex].kind !== 'math')
    throw new Error('Expected math token');
  const previous = tokens[mathIndex - 1];
  const next = tokens[mathIndex + 1];
  const start = previous?.kind === 'text' && OPEN.has(previous.char) ?
    mathIndex - 1 : mathIndex;
  const end = next?.kind === 'text' && CLOSE.has(next.char) ?
    mathIndex + 2 : mathIndex + 1;
  return { start, end };
}

function nativeSpan(text, start) {
  const span = document.createElement('span');
  span.dataset.nativeTextStart = String(start);
  span.textContent = text;
  return span;
}

function createMathBox(id, box) {
  const wrapper = document.createElement('span');
  wrapper.dataset.nativeMath = id;
  // A true CSS atomic inline, not an MJX wrapper. Match reported advance,
  // ascent and descent; SVG is solely the geometric measurement target.
  Object.assign(wrapper.style, {
    display: 'inline-block', width: box.width + 'px',
    height: box.ascent + box.descent + 'px',
    verticalAlign: -box.descent + 'px',
    boxSizing: 'content-box',
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(box.width));
  svg.setAttribute('height', String(box.ascent + box.descent));
  svg.style.display = 'block';
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '0.5');
  rect.setAttribute('y', '0.5');
  rect.setAttribute('width', String(Math.max(0, box.width - 1)));
  rect.setAttribute('height', String(Math.max(0, box.ascent + box.descent - 1)));
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', '#798994');
  svg.append(rect);
  wrapper.append(svg);
  return wrapper;
}

export function makeIsolationCase({
  source, mathById, boxes, width, fontSize = 20, family = 'sans-serif',
  variant = 'mathjax', lineBreak = 'auto',
}) {
  if (!VARIANTS.includes(variant)) throw new Error('Unknown isolation variant: ' + variant);
  if (!['auto', 'strict'].includes(lineBreak)) throw new Error('Invalid line-break policy');
  if (!Number.isFinite(width) || width <= 0) throw new Error('Invalid width');
  const items = parseDocument(source);
  const mathItems = items.filter(item => item.type === 'math');
  if (mathItems.length !== 1) throw new Error('Isolation control requires exactly one inline formula');
  const root = document.createElement('div');
  root.className = 'native-comparison-canvas css-isolation-canvas';
  root.lang = 'ja';
  root.dataset.variant = variant;
  root.dataset.lineBreak = lineBreak;
  Object.assign(root.style, {
    width: width + 'px', boxSizing: 'content-box', fontSize: fontSize + 'px',
    fontFamily: family, lineHeight: '1.6', whiteSpace: 'pre-wrap',
    overflowWrap: 'normal', wordBreak: 'normal',
    lineBreak, textAutospace: 'no-autospace', textSpacingTrim: 'space-all',
  });

  const oneMath = mathItems[0];
  const plain = variant === 'flat-text' || variant === 'inline-text';
  if (variant === 'flat-text') {
    const fullText = items.map(item => item.type === 'text' ? item.text : '式').join('');
    root.append(nativeSpan(fullText, 0));
    return {
      root, items: [{ type: 'text', text: fullText, start: 0, end: fullText.length }],
      boxes: new Map(), originalSource: source, substitute: true,
    };
  }
  const tokens = [];
  const observedItems = [];
  for (const item of items) {
    if (item.type === 'text') {
      observedItems.push(item);
      for (const { segment, index } of SEGMENTER.segment(item.text))
        tokens.push({ kind: 'text', char: segment, start: item.start + index });
    } else if (plain) {
      observedItems.push({
        type: 'text', text: '式', start: item.start, end: item.end,
      });
      tokens.push({ kind: 'text', char: '式', start: item.start });
    } else {
      observedItems.push(item);
      tokens.push({ kind: 'math', id: item.id, start: item.start });
    }
  }
  const activeBoxes = new Map();
  const nodes = tokens.map(token => {
    if (token.kind === 'text') return nativeSpan(token.char, token.start);
    const box = boxes.get(token.id);
    if (!box) throw new Error('No measured math box: ' + token.id);
    activeBoxes.set(token.id, box);
    if (variant.startsWith('mathjax')) {
      const measured = mathById.get(token.id);
      if (!measured) throw new Error('MathJax container not found: ' + token.id);
      const cloned = measured.cloneNode(true);
      cloned.dataset.nativeMath = token.id;
      return cloned;
    }
    return createMathBox(token.id, box);
  });

  const mathIndex = tokens.findIndex(token => token.kind === 'math');
  if (mathIndex !== -1 && (variant.includes('nowrap') || variant.includes('group-box'))) {
    const { start, end } = groupNeighbors(tokens, mathIndex);
    const wrapper = document.createElement('span');
    wrapper.dataset.group = variant;
    if (variant.includes('group-box')) {
      wrapper.style.display = 'inline-block';
      wrapper.style.whiteSpace = 'nowrap';
    } else {
      wrapper.style.whiteSpace = 'nowrap';
    }
    wrapper.append(...nodes.slice(start, end));
    root.append(...nodes.slice(0, start), wrapper, ...nodes.slice(end));
  } else {
    root.append(...nodes);
  }
  return { root, items: observedItems, boxes: activeBoxes,
    originalSource: source, substitute: plain };
}

export function measureIsolationCase(spec) {
  const { root, items, boxes } = spec;
  if (!root.isConnected) throw new Error('Probe must be attached to layout tree');
  const edges = inspectNativeLineEdges(root, items, boxes);
  return {
    ...edges, variant: root.dataset.variant, lineBreak: root.dataset.lineBreak,
    width: root.getBoundingClientRect().width,
    overflow: root.scrollWidth > root.clientWidth + 1,
  };
}
