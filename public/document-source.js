export class MathSourceError extends Error {
  constructor(message, source, offset) {
    const prefix = source.slice(0, offset);
    const line = prefix.split(/\r\n|\r|\n/).length;
    const column = [...prefix.split(/\r\n|\r|\n/).at(-1)].length + 1;
    super(`${line}行${column}列：${message}`);
    this.name = 'MathSourceError';
    this.offset = offset;
    this.line = line;
    this.column = column;
  }
}

// Delimiters are \( ... \). Even numbers of consecutive backslashes escape
// a delimiter. Offsets are UTF-16 indices, suitable for textarea selection.
export function parseDocument(source) {
  if (typeof source !== 'string') throw new TypeError('Source must be a string');
  const items = [];
  let textStart = 0, mathStart = -1, formulaCount = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== '\\') continue;
    let end = i;
    while (source[end] === '\\') end++;
    const delimiter = end - 1;
    if ((end - i) % 2 === 1 && ['(', ')'].includes(source[end])) {
      if (source[end] === '(') {
        if (mathStart >= 0) throw new MathSourceError('数式の中に開始記号があります。', source, delimiter);
        if (delimiter > textStart) items.push({ type: 'text', text: source.slice(textStart, delimiter), start: textStart, end: delimiter });
        mathStart = delimiter;
      } else {
        if (mathStart < 0) throw new MathSourceError('対応する数式の開始記号がありません。', source, delimiter);
        const tex = source.slice(mathStart + 2, delimiter);
        if (!tex.trim()) throw new MathSourceError('数式が空です。', source, mathStart);
        items.push({ type: 'math', id: `math-${++formulaCount}`, tex, raw: source.slice(mathStart, end + 1), start: mathStart, end: end + 1 });
        mathStart = -1;
        textStart = end + 1;
      }
      i = end;
    } else i = end - 1;
  }
  if (mathStart >= 0) throw new MathSourceError('数式の終了記号がありません。', source, mathStart);
  if (textStart < source.length) items.push({ type: 'text', text: source.slice(textStart), start: textStart, end: source.length });
  return items;
}

export function documentSource(items) {
  return items.map(item => item.type === 'text' ? item.text : item.raw ?? `\\(${item.tex}\\)`).join('');
}

export const documentExamples = {
  mixed: String.raw`関数 \(f(x)=x^2\) を考える。微分は \(f'(x)=2x\) であり、\(x\in\mathbb{R}\) で定義される。
分数 \(\frac{1}{1+x^2}\) と、背の高い式（\(\dfrac{\sum_{k=1}^{n} k^2}{1+\dfrac{1}{x}}\)）も同じ文章に配置する。

  空白を含む English words と数式 \(a+b=c\) を並べる。同じ式 \(a+b=c\) も別の位置として保持する。`,
  boundaries: String.raw`条件は（\(a+b=c\)）で与えられる。結果は \(x^2\)。
式 \(a\)\(b\) を隣接させる。続けて \(\frac{1}{x}\) と \(\frac{1}{y}\) を比較する。`,
  long: Array.from({ length: 10 }, (_, i) => String.raw`第${i + 1}段落。関数 \(f_${i + 1}(x)=x^2+${i + 1}\) と分数 \(\frac{1}{1+x^2}\) を比較する。幅を変えても文章と式の順序を保持し、句読点や括弧の折り返しを観察する。`).join('\n\n'),
  oversize: String.raw`長い式 \(a=b_1+b_2+b_3+b_4+b_5+b_6+b_7+b_8\) を含む文章。原文は幅不足でも保持する。`,
};
