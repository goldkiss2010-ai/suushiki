import { svgString } from '@non-standardworld/stone-engine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Geometry belongs to layoutDocument. The renderer never recomputes line breaks.
export function mountDocument(result, svgById, { width, showFrames = false, showBaselines = false } = {}) {
  if (!result.ctx || result.displayAllowed === false) return null;
  const targetWidth = width ?? result.ctx.renderSize.width;
  const height = result.renderedSize.height;
  const hidden = [];
  try {
    for (const run of result.runs) if (run.mathId) {
      hidden.push([run, run.visibility]);
      run.visibility = 'invisible';
    }
    const template = document.createElement('template');
    template.innerHTML = svgString(result.ctx, { showFrames });
    const textSvg = template.content.firstElementChild;
    if (!textSvg || textSvg.localName !== 'svg') throw new Error('Stone の SVG を生成できませんでした。');
    // Math can extend above and below Stone's original fixed line viewport.
    textSvg.setAttribute('width', String(targetWidth));
    textSvg.setAttribute('height', String(height));
    textSvg.setAttribute('viewBox', '0 0 ' + targetWidth + ' ' + height);
    textSvg.style.display = 'block';
    if (showBaselines) {
      const guides = document.createElementNS(SVG_NS, 'g');
      guides.setAttribute('aria-hidden', 'true');
      for (const line of result.lines) {
        const guide = document.createElementNS(SVG_NS, 'line');
        guide.setAttribute('x1', '0');
        guide.setAttribute('x2', String(targetWidth));
        guide.setAttribute('y1', String(line.baseline));
        guide.setAttribute('y2', String(line.baseline));
        guide.setAttribute('stroke', '#c04747');
        guide.setAttribute('stroke-width', '0.65');
        guides.append(guide);
      }
      textSvg.append(guides);
    }
    const paragraph = document.createElement('div');
    paragraph.className = 'document-canvas';
    paragraph.style.position = 'relative';
    paragraph.style.width = targetWidth + 'px';
    paragraph.style.height = height + 'px';
    paragraph.append(textSvg);
    for (const geometry of result.geometry) {
      const measuredSvg = svgById.get(geometry.id);
      if (!measuredSvg) throw new Error('数式 ' + geometry.id + ' の SVG がありません。');
      const svg = measuredSvg.cloneNode(true);
      svg.setAttribute('width', String(geometry.width));
      svg.setAttribute('height', String(geometry.height));
      svg.setAttribute('data-document-math', geometry.id);
      Object.assign(svg.style, {
        position: 'absolute', display: 'block',
        left: geometry.x + 'px', top: geometry.y + 'px',
        width: geometry.width + 'px', height: geometry.height + 'px',
        maxWidth: 'none',
      });
      paragraph.append(svg);
      if (showFrames) {
        const frame = document.createElement('div');
        frame.className = 'document-math-frame';
        Object.assign(frame.style, {
          position: 'absolute', pointerEvents: 'none',
          left: geometry.x + 'px', top: geometry.y + 'px',
          width: geometry.width + 'px', height: geometry.height + 'px',
        });
        paragraph.append(frame);
      }
    }
    return paragraph;
  } finally {
    for (const [run, visibility] of hidden) run.visibility = visibility;
  }
}
