// Explicit paragraph policy for the outside of a math box. Do not inspect TeX:
// formula-internal glue belongs solely to MathJax.
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const WORD = /[\p{L}\p{N}]/u;
const WHITESPACE = /\s/u;
export const BOUNDARY_POLICIES = ['none', 'quarter', 'contextual', 'elastic'];

function adjacentSourceChar(items, index, direction) {
  const item = items[index + direction];
  if (!item || item.type !== 'text' || !item.text) return null;
  const chars = Array.from(item.text);
  return direction === -1 ? chars.at(-1) : chars[0];
}

function eligible(char, policy) {
  if (!char || WHITESPACE.test(char)) return false;
  if (policy === 'quarter') return true;
  return JAPANESE.test(char) || WORD.test(char);
}

// Each candidate includes a physical gap only where input does not already
// contain an explicit space. 'quarter' is deliberately permissive, including
// punctuation; 'contextual' excludes punctuation and symbols.
export function mathBoundaryGaps(items, index, { policy = 'none', fontSize = 20 } = {}) {
  if (!BOUNDARY_POLICIES.includes(policy)) throw new Error('未対応の数式境界方針です。');
  if (!Number.isFinite(fontSize) || fontSize <= 0) throw new Error('境界アキの文字サイズが不正です。');
  const before = adjacentSourceChar(items, index, -1);
  const after = adjacentSourceChar(items, index, 1);
  const quarter = fontSize * 0.25;
  const left = policy !== 'none' && eligible(before, policy) ? quarter : 0;
  const right = policy !== 'none' && eligible(after, policy) ? quarter : 0;
  // Experimental TeX-like glue contract: elasticity is reported as a budget,
  // not yet used by a justification/optimal-line-breaking algorithm.
  const glue = natural => ({
    natural, stretch: policy === 'elastic' ? natural : 0,
    shrink: policy === 'elastic' ? natural / 2 : 0,
  });
  return {
    left, right, leftGlue: glue(left), rightGlue: glue(right),
    before, after, policy, unit: 'css-px', provenance: 'generated-boundary',
  };
}
