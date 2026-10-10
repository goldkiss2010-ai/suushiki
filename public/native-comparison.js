// Browser-native control for the *same* source and MathJax output as SUUSHIKI.
// Browser inline layout remains the sole owner of this control's line breaks.
// No injected inter-character spaces, no Stone positioning, no hidden renderer.
const MODES = ['plain', 'modern'];
export const NATIVE_COMPARISON_MODES = Object.freeze(MODES);

export function mountNativeComparison(items, mathById, {
  width, fontSize, family, nativeMode = 'plain',
} = {}) {
  if (!MODES.includes(nativeMode)) throw new Error('Unknown native comparison mode');
  if (!(width > 0) || !(fontSize > 0)) throw new Error('Invalid comparison dimensions');
  const root = document.createElement('div');
  root.className = 'native-comparison-canvas';
  Object.assign(root.style, {
    boxSizing: 'content-box',
    width: width + 'px',
    fontSize: fontSize + 'px',
    fontFamily: family,
    lineHeight: '1.6',
    textAlign: 'start',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'normal',
    wordBreak: 'normal',
    letterSpacing: 'normal',
    textAutospace: nativeMode === 'modern' ? 'normal' : 'no-autospace',
    textSpacingTrim: nativeMode === 'modern' ? 'trim-start' : 'space-all',
  });
  root.dataset.nativeMode = nativeMode;
  for (const item of items) {
    if (item.type === 'text') {
      const span = document.createElement('span');
      span.dataset.nativeTextStart = String(item.start);
      span.textContent = item.text;
      root.append(span);
    } else {
      const measured = mathById.get(item.id);
      if (!measured) throw new Error('Missing MathJax container: ' + item.id);
      const clone = measured.cloneNode(true);
      clone.dataset.nativeMath = item.id;
      clone.dataset.sourceStart = String(item.start);
      root.append(clone);
    }
  }
  return root;
}

function dimension(rect, origin) {
  return {
    x: rect.x - origin.x, y: rect.y - origin.y,
    width: rect.width, height: rect.height,
  };
}

// Measure individual rendered *text* grapheme fragments with DOM Range rather
// than guessing where CSS has wrapped text. Math is reported as independent
// bounding rectangles. An empty hard line or math-only line is not a text
// bearing line; do not disguise that count as a total paragraph line count.
export function measureNativeComparison(root, items) {
  const origin = root.getBoundingClientRect();
  const charBoxes = [];
  const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  for (const span of root.querySelectorAll('[data-native-text-start]')) {
    const node = span.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) continue;
    const sourceStart = Number(span.dataset.nativeTextStart);
    for (const { segment, index } of segmenter.segment(node.data)) {
      if (!segment.trim() || /[\r\n]/u.test(segment)) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + segment.length);
      const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
      // Mixed inline MathJax may create multiple rects. Keep fragments explicit.
      for (const rect of rects) {
        charBoxes.push({
          char: segment, sourceOffset: sourceStart + index, ...dimension(rect, origin),
        });
      }
    }
  }
  const lines = [];
  for (const box of [...charBoxes].sort((a, b) => a.y - b.y || a.sourceOffset - b.sourceOffset)) {
    let line = lines.find(row => Math.abs(row.textTop - box.y) <= 1);
    if (!line) {
      line = { textTop: box.y, boxes: [] };
      lines.push(line);
    }
    line.boxes.push(box);
  }
  const textLines = lines.sort((a, b) => a.textTop - b.textTop).map((line, index) => {
    const ordered = line.boxes.sort((a, b) => a.sourceOffset - b.sourceOffset);
    return {
      index, top: line.textTop,
      startOffset: ordered[0].sourceOffset,
      endOffset: ordered.at(-1).sourceOffset + ordered.at(-1).char.length,
      firstText: ordered[0].char,
      lastText: ordered.at(-1).char,
      // These are text-fragment bounds, not whole-line / full glyph ink bounds.
      left: Math.min(...ordered.map(rect => rect.x)),
      right: Math.max(...ordered.map(rect => rect.x + rect.width)),
    };
  });
  const mathBoxes = [...root.querySelectorAll('[data-native-math]')].map(container => {
    const svg = container.querySelector('svg');
    if (!svg) throw new Error('Missing native MathJax SVG');
    return { id: container.dataset.nativeMath, ...dimension(svg.getBoundingClientRect(), origin) };
  });
  const availableWidth = origin.width;
  const mathOverflows = mathBoxes.filter(box => box.x < -0.5 ||
    box.x + box.width > availableWidth + 0.5).map(box => box.id);
  const reconstructedSource = items.map(item => item.type === 'text' ?
    [...root.querySelectorAll('[data-native-text-start]')]
      .find(span => Number(span.dataset.nativeTextStart) === item.start)?.textContent :
    item.raw).join('');
  const computed = getComputedStyle(root);
  return {
    engine: 'browser-inline-layout+MathJax',
    nativeMode: root.dataset.nativeMode,
    // Browser support can change; never imply that "modern" was effective.
    cssSupport: {
      textAutospace: CSS.supports('text-autospace', 'normal'),
      textSpacingTrim: CSS.supports('text-spacing-trim', 'trim-start'),
    },
    computedCSS: {
      textAutospace: computed.getPropertyValue('text-autospace').trim(),
      textSpacingTrim: computed.getPropertyValue('text-spacing-trim').trim(),
      whiteSpace: computed.whiteSpace,
      lineHeight: computed.lineHeight,
    },
    sourceMatches: reconstructedSource === items.map(item =>
      item.type === 'text' ? item.text : item.raw).join(''),
    mathCount: mathBoxes.length,
    mathBoxes,
    mathOverflows,
    textBearingLineCount: textLines.length,
    textLines,
    // Overflow measurement is separate from the height and wrap heuristics.
    horizontalOverflow: root.scrollWidth > root.clientWidth + 1 || mathOverflows.length > 0,
    scrollWidth: root.scrollWidth, clientWidth: root.clientWidth,
    height: origin.height,
  };
}

export function nativeComparisonSummary(native, suushiki) {
  const total = suushiki?.lines?.length ?? null;
  return [
    '通常HTML: 本文を含む行 ' + native.textBearingLineCount +
      '／MathJax数式 ' + native.mathCount + '個／横はみ出し ' +
      (native.horizontalOverflow ? 'あり' : 'なし'),
    'SUUSHIKI: 総行数 ' + (total ?? '未配置') +
      '／状態 ' + suushiki.status,
    'CSS機能: text-autospace ' + (native.cssSupport.textAutospace ? '対応' : '非対応') +
      '、text-spacing-trim ' + (native.cssSupport.textSpacingTrim ? '対応' : '非対応'),
    '注意：HTML側の行数は本文の描画片を数えたもので、空行・数式のみの行を含みません。',
    '書式の比較であり、どちらかの品質が優れているという自動判定ではありません。',
  ].join('\n');
}
