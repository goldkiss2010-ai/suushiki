// The flowable native control uses MathJax 4's browser-driven inline breaks.
// SUUSHIKI itself continues to request exactly one SVG per formula.
// MathJax's output-jax flag is scoped to a single conversion and restored
// even if the TeX conversion fails; never label an atomic clone as flowable.
export async function typesetFlowableMath(tex, { width, fontSize, family }) {
  const output = window.MathJax?.startup?.document?.outputJax;
  const linebreaks = output?.options?.linebreaks;
  if (!linebreaks || typeof linebreaks.inline !== 'boolean') {
    throw new Error('MathJax 4 inline linebreaks setting is not available');
  }
  const row = document.createElement('span');
  Object.assign(row.style, {
    position: 'absolute', visibility: 'hidden', left: '0', top: '0',
    width: width + 'px', display: 'block',
    fontSize: fontSize + 'px', fontFamily: family, lineHeight: '1.6',
  });
  document.body.append(row);
  const previous = linebreaks.inline;
  try {
    linebreaks.inline = true;
    const metrics = window.MathJax.getMetricsFor(row, false);
    const math = await window.MathJax.tex2svgPromise(tex, { ...metrics, display: false });
    row.append(math);
    await document.fonts.ready;
    const svgCount = math.querySelectorAll('svg').length;
    if (!svgCount || math.querySelector('[data-mml-node="merror"]'))
      throw new Error('MathJax could not produce flowable SVG for ' + tex);
    return { math: math.cloneNode(true), svgCount };
  } finally {
    linebreaks.inline = previous;
    row.remove();
  }
}
