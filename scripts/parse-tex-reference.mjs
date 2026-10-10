// Parse tagged, machine-readable measurements from a LuaLaTeX log.
const NUM = '[+-]?\\d+(?:\\.\\d+)?';
const DIM = new RegExp('^(' + NUM + ')pt$');
const GLUE = new RegExp('^(' + NUM + ')pt(?: plus (' + NUM + ')pt)?(?: minus (' + NUM + ')pt)?$');

export function parseDimension(text) {
  const match = text.trim().match(DIM);
  if (!match) throw new Error('Unexpected TeX dimension: ' + text);
  return Number(match[1]);
}

export function parseGlue(text) {
  const match = text.trim().match(GLUE);
  if (!match) throw new Error('Unexpected TeX glue: ' + text);
  return {
    naturalPt: Number(match[1]),
    stretchPt: Number(match[2] ?? 0),
    shrinkPt: Number(match[3] ?? 0),
  };
}

export function parseLatexLog(log) {
  const parsed = { parameters: {}, hboxesPt: {}, partsPt: {}, paragraphs: {} };
  const entries = log.split(/\r?\n/).filter(line => line.startsWith('SUUSHIKI|'));
  for (const line of entries) {
    const [prefix, kind, key, ...values] = line.trim().split('|');
    if (prefix !== 'SUUSHIKI' || !kind || !key) throw new Error('Malformed tag: ' + line);
    if (kind === 'parameter') {
      if (key === 'zw') parsed.parameters.zwPt = parseDimension(values[0]);
      else if (key === 'mathsurround') parsed.parameters.mathsurroundPt = parseDimension(values[0]);
      else if (key === 'xkanjiskip' || key === 'kanjiskip') parsed.parameters[key] = parseGlue(values[0]);
      else throw new Error('Unknown parameter: ' + key);
    } else if (kind === 'hbox' || kind === 'part') {
      const target = kind === 'hbox' ? parsed.hboxesPt : parsed.partsPt;
      if (Object.hasOwn(target, key)) throw new Error('Duplicate measurement: ' + key);
      target[key] = parseDimension(values[0]);
    } else if (kind === 'paragraph') {
      // LuaTeX's log can append "(./reference.aux)" after the last tag.
      // Accept only a trailing TeX log annotation, never a malformed number.
      const cells = values.map((value, index) => index === 2 ?
        value.match(/^(\d+)(?:\s|$)/)?.[1] : (/^\d+$/.test(value) ? value : null));
      if (values.length !== 3 || cells.some(value => value === null || value === undefined)) {
        throw new Error('Malformed paragraph measurement: ' + line);
      }
      if (Object.hasOwn(parsed.paragraphs, key)) throw new Error('Duplicate paragraph: ' + key);
      const widthZw = Number(key.match(/-(\d+)zw$/)?.[1]);
      if (!Number.isFinite(widthZw) || !widthZw) throw new Error('No paragraph width: ' + key);
      parsed.paragraphs[key] = {
        widthZw, lineCount: Number(cells[0]), heightSp: Number(cells[1]), depthSp: Number(cells[2]),
      };
    } else throw new Error('Unknown measurement type: ' + kind);
  }
  for (const key of ['mathsurroundPt', 'xkanjiskip', 'kanjiskip', 'zwPt']) {
    if (parsed.parameters[key] === undefined) throw new Error('Missing parameter: ' + key);
  }
  for (const key of ['t02a', 't02b', 't02c', 't07']) {
    if (parsed.hboxesPt[key] === undefined) throw new Error('Missing hbox: ' + key);
  }
  for (const key of ['left', 'math', 'right']) {
    if (parsed.partsPt[key] === undefined) throw new Error('Missing part: ' + key);
  }
  for (const key of ['t02a-twice-12zw', 't02a-twice-24zw', 't02b-twice-12zw']) {
    if (parsed.paragraphs[key] === undefined) throw new Error('Missing paragraph: ' + key);
  }
  return parsed;
}

export function derivedReference(data) {
  const { xkanjiskip, zwPt } = data.parameters;
  const totalGapPt = data.hboxesPt.t02a - Object.values(data.partsPt).reduce((a, b) => a + b, 0);
  return {
    naturalPerZw: xkanjiskip.naturalPt / zwPt,
    stretchPerZw: xkanjiskip.stretchPt / zwPt,
    shrinkPerZw: xkanjiskip.shrinkPt / zwPt,
    observedTwoBoundaryGapPt: totalGapPt,
    expectedTwoBoundaryGapPt: 2 * xkanjiskip.naturalPt,
  };
}
