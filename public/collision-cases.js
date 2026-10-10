// Executable counterparts of examples/math-conflicts.md (T01–T07).
// Reproducible inputs are not evidence that a typographic rule is solved.
// The source parser accepts \( ... \), not dollar delimiters.
export const collisionCases = {
  t01: {
    label: 'T01 式内構造と本文の調整',
    focus: '数式内部は MathJax に保持。段落は数式ボックスの位置だけを決定します。',
    source: '関数\\(\\left(\\frac{a}{b}\\right)+c=d\\)をここで定め、次の条件を考える。',
    expectedFormulaCount: 1,
  },
  t02a: {
    label: 'T02a 明示空白なし',
    focus: '自動の本文・数式境界アキ規則はまだ未実装です。',
    source: '関数\\(f(x)=x^2\\)を考える。',
    expectedFormulaCount: 1,
  },
  t02b: {
    label: 'T02b 明示空白あり',
    focus: '本文の ASCII 空白が左右にある場合。T02a と比較します。',
    source: '関数 \\(f(x)=x^2\\) を考える。',
    expectedFormulaCount: 1,
  },
  t02d: {
    label: 'T02d LaTeXの行数比較',
    focus: '同じ文を2回続け、12文字幅・24文字幅での LuaLaTeX + jlreq の行数と比較します。フォント差があるため一致を合格とはしません。',
    source: '関数\\(f(x)=x^2\\)を考える。'.repeat(2),
    expectedFormulaCount: 2,
  },
  t02c: {
    label: 'T02c 句読点・括弧との境界',
    focus: '読点・括弧と数式の境界を観察します。',
    source: '値\\(x\\)、\\(y\\)。また（\\(z\\)）を用いる。',
    expectedFormulaCount: 3,
  },
  t03a: {
    label: 'T03a 式の直後に句点',
    focus: '式を非分割とし、右側にある句点の行頭禁則を確認します。',
    source: '十分に長い説明の後で\\(a+b=c\\)。次の条件を考える。',
    expectedFormulaCount: 1,
  },
  t03b: {
    label: 'T03b 式を囲む括弧',
    focus: '開き括弧の行末、閉じ括弧の行頭を観察します。',
    source: 'この条件は（\\(a+b=c\\)）で与えられる。',
    expectedFormulaCount: 1,
  },
  t04: {
    label: 'T04 高い分数と行送り',
    focus: '固定と内容連動の行送りを比較します。',
    source: ['上の行の本文を置く。',
      '基準Hと\\(x\\)、\\(x^2\\)、\\(\\frac{1}{1+\\frac1x}\\)を置く。',
      '下の行の本文を置く。'].join('\n'),
    expectedFormulaCount: 3,
  },
  t05: {
    label: 'T05 1つの行分割決定',
    focus: '数式内部の改行を認めず、SVG の寸法と組版座標を比較します。',
    source: '次の関係\\(a=b_1+b_2+b_3+b_4\\)を用いて説明を続ける。',
    expectedFormulaCount: 1,
  },
  t06a: {
    label: 'T06a 列幅を超える式',
    focus: '数式幅未満の場合の原文保存・描画保留を確認します。',
    source: '条件\\(a=b_1+b_2+b_3+b_4+b_5+b_6+b_7\\)を用いる。',
    expectedFormulaCount: 1,
  },
  t06b: {
    label: 'T06b 有限高さと省略（未実装）',
    focus: '原文と式の基本配置のみ。有限高さ・省略・縮小は未実装です。',
    source: '説明を続ける。説明を続ける。条件\\(a+b=c\\)を用いる。',
    expectedFormulaCount: 1,
  },
  t07: {
    label: 'T07 描画と数式ソース対応',
    focus: '原文と2つの TeX を検証。範囲選択と読み上げは未実装です。',
    source: '実数\\(\\mathbb{R}\\)上で\\(f(x)\\)を考える。',
    expectedFormulaCount: 2,
  },
};
export const collisionCaseKeys = Object.keys(collisionCases);
