// Dimensionless diagnostics. TeX pt/zw and browser CSS px/em are deliberately
// kept separate; exact pixel widths are NOT comparable with different fonts.
export function compareWithLatex(result, settings, reference, benchmarkSource) {
  const { zwPt, mathsurroundPt, xkanjiskip } = reference.parameters;
  if (![zwPt, settings.fontSize].every(n => Number.isFinite(n) && n > 0))
    throw new Error('Invalid reference or browser font size.');
  const latex = {
    xkanjiskipNaturalZw: xkanjiskip.naturalPt / zwPt,
    xkanjiskipStretchZw: xkanjiskip.stretchPt / zwPt,
    xkanjiskipShrinkZw: xkanjiskip.shrinkPt / zwPt,
    mathsurroundZw: mathsurroundPt / zwPt,
    hboxWidthZw: Object.fromEntries(Object.entries(reference.hboxesPt)
      .map(([key, pt]) => [key, pt / zwPt])),
  };
  const geometry = result.geometry ?? [];
  const sum = (key) => geometry.reduce((n, item) => n +
    (item.boundary?.appliedGlueLeft?.[key] ?? 0) +
    (item.boundary?.appliedGlueRight?.[key] ?? 0), 0);
  const suushiki = {
    source: result.source,
    status: result.status,
    boundaryPolicy: result.boundarySpacing,
    naturalEm: sum('natural') / settings.fontSize,
    stretchEm: sum('stretch') / settings.fontSize,
    shrinkEm: sum('shrink') / settings.fontSize,
    lineCount: result.lineCount ?? null,
    renderedWidthEm: Number.isFinite(result.renderedSize?.width)
      ? result.renderedSize.width / settings.fontSize : null,
  };
  let paragraph = null;
  // Line-count comparison is informational only: different fonts and
  // line-breaking algorithms do not make equality a correctness criterion.
  if (result.source === benchmarkSource && Number.isFinite(result.lineCount)) {
    const nominalZw = settings.width / settings.fontSize;
    const matched = Object.entries(reference.paragraphs)
      .find(([key, measured]) => key.startsWith('t02a-twice-') &&
        Math.abs(measured.widthZw - nominalZw) < 1e-9);
    if (matched) paragraph = {
      widthInBrowserEm: nominalZw,
      widthInTexZw: matched[1].widthZw,
      latexLines: matched[1].lineCount,
      suushikiLines: result.lineCount,
      sameLineCount: matched[1].lineCount === result.lineCount,
      comparable: false,
      explanation: 'Font metrics, math fonts, glue and line-breaking algorithms differ.',
    };
  }
  return {
    baseline: { ...reference.provenance },
    latex, suushiki, paragraph,
    directPixelParity: false,
    comparisonScope: 'Dimensionless nominal glue / illustrative paragraph line count only',
  };
}

export function comparisonText(comparison) {
  const p = comparison.paragraph;
  const l = comparison.latex;
  const s = comparison.suushiki;
  const fmt = value => Number(value.toFixed(4));
  const rows = [
    'LuaLaTeX / jlreq 参照: xkanjiskip = ' +
      fmt(l.xkanjiskipNaturalZw) + ' zw（自然幅） + ' +
      fmt(l.xkanjiskipStretchZw) + ' zw（伸長） - ' +
      fmt(l.xkanjiskipShrinkZw) + ' zw（縮小）',
    'SUUSHIKI: 実際の生成アキ合計 = ' + fmt(s.naturalEm) +
      ' CSS em、伸長予算 = ' + fmt(s.stretchEm) +
      ' CSS em、縮小予算 = ' + fmt(s.shrinkEm) + ' CSS em',
    '注意：SUUSHIKIの伸縮予算は診断専用。現在の配置では自然幅だけを使用しています。',
  ];
  if (p) rows.push('同じ名目幅 ' + p.widthInTexZw + '：' +
    'LaTeX ' + p.latexLines + '行 / SUUSHIKI ' + p.suushikiLines +
    '行（フォントが違うため合否判定はしません）');
  rows.push('TeXのzwとCSSのemは別の単位です。数式・日本語フォントが一致しない限り総幅の直接比較はしません。');
  return rows.join('\n');
}
