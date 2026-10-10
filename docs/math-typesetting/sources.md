# 一次資料・公式書誌

確認日：2026-10-10。番号 S01–S18 は [ルール一覧](rules.md) と共通。

確認状態の「本文」は本調査で使う該当箇所を読んだことを示し、全文精読を意味しない。「取得部分」は公式文書の検索結果で読めた範囲のみ。「書誌」は本文未確認で、規則の根拠には用いない。

## 数式エンジン・構造

| ID | 資料・版 | 確認状態 | 参照箇所・用途 |
| --- | --- | --- | --- |
| S01 | Donald E. Knuth, [TeX: tex.web](https://tug.ctan.org/systems/knuth/dist/tex/tex.web), 3.141592653 (2021)。[公式配布書誌](https://ctan.org/tex-archive/systems/knuth/dist/tex) | 本文 | 数式要素（§682）、mlist_to_hlist、Do first-pass processing、math_spacing、Append inter-element spacing、Append any new_hlist entries。要素・スタイル・Bin 再分類・間隔・改行 |
| S02 | LaTeX Project, [fontdef.dtx](https://github.com/latex3/latex2e/blob/77e08cfb628c254d5ec78f8d3c1103657539e666/base/fontdef.dtx)、[ltplain.dtx](https://github.com/latex3/latex2e/blob/77e08cfb628c254d5ec78f8d3c1103657539e666/base/ltplain.dtx)、[ltmath.dtx](https://github.com/latex3/latex2e/blob/77e08cfb628c254d5ec78f8d3c1103657539e666/base/ltmath.dtx) | 本文 | 既定の数式間隔・penalty、明示的な空き命令。参照コミットを固定 |
| S03 | AMS / LaTeX Project, [User's Guide for the amsmath Package](https://latex-project.org/help/documentation/amsldoc.pdf), guide Version 2.1、表紙改訂日 2020-02-18 | 本文 | §2–3、§4.1–4.3、§4.11、§4.14、§5–7。著者が選ぶ構成と配置。guide の版とパッケージの版は別 |
| S04 | LaTeX3 Project, [unicode-math user guide](https://tug.ctan.org/macros/unicodetex/latex/unicode-math/unicode-math.pdf), CTAN 0.8r (2023-08-13)。[開発元の文書ソース](https://github.com/latex3/unicode-math/blob/master/um-doc-main.tex) | 本文 | §5.1–5.2、§5.5。TeX / ISO / french / upright / literal と太字の方針。ISO 本文の代替とはしない |
| S05 | W3C, [MathML Core](https://www.w3.org/TR/2025/CR-mathml-core-20250624/), Candidate Recommendation Snapshot, 2025-06-24 | 本文 | §3.1、§3.2.2–3.2.4、§3.3–3.4、§4.2、§5、Appendix B。ブラウザー向けの具体的な配置規定 |
| S06 | W3C, [MathML 4.0](https://www.w3.org/TR/2026/WD-mathml4-20261001/), Working Draft, 2026-10-01 | 本文 | §3.1.7、§3.2.6.2.2–3.2.6.2.3。改行候補、演算子の前後位置、継続行の整列。草案であり実装保証ではない |

S01 はアルゴリズムの一次資料、S02 はその上で用いる既定値の一次資料である。TeX の配置を理解することと、すべての出版物が TeX の既定値に従うことは別である。

S05 は W3C Recommendation ではなく Candidate Recommendation Snapshot、S06 は Working Draft として参照する。Core と完全版 MathML の範囲を区別する。

## フォント・文字

| ID | 資料・版 | 確認状態 | 参照箇所・用途 |
| --- | --- | --- | --- |
| S07 | Microsoft, [OpenType 1.9.1: MATH table](https://learn.microsoft.com/en-us/typography/opentype/spec/math) | 本文 | MathConstants、MathGlyphInfo、MathVariants。配置用のフォント情報。表自体の version 1.0 と OpenType の版は別 |
| S08 | Unicode Consortium, [Unicode Technical Report #25: Unicode Support for Mathematics](https://www.unicode.org/reports/tr25/tr25-15.pdf), revision 15, 2017-05-30 | 本文 | §2.1–2.2、§2.14。数学用アルファベットと不可視演算子 |

S07 はフォント内のデータ形式を定義する。完全な数式レイアウト手順を定義する仕様ではない。MathJax がこのテーブルを直接読んで動作するとも本調査では仮定しない。

## 日本語組版・出版方針

| ID | 資料・版 | 確認状態 | 参照箇所・用途 |
| --- | --- | --- | --- |
| S09 | W3C, [日本語組版処理の要件 / JLREQ](https://www.w3.org/TR/2020/NOTE-jlreq-20200811/), Working Group Note, 2020-08-11 | 本文 | §3.1.7–3.1.10、§3.2.6、§3.7.4、Appendix B。本文との境界、禁則、等号類・演算記号 |
| S10 | 日本数学会, [雑誌『数学』原稿の作り方・論文作成の手引](https://www.mathsoc.jp/assets/pdf/publications/sugaku/sugaku-kitei.pdf) | 本文 | 付録 II, II「数式，記号，文字指定について」、I.8。複雑な添え字の回避、関数名の立体指定。版日付は本調査で未確定 |
| S11 | 日本数学会, [『数学』用クラスファイルの解説](https://mathsoc.jp/publication/sugaku/sty/sugaku.pdf) | 取得部分のみ | §3.8、表1、および太字・式番号の記述。本文中の分数と別行式の分数、句読点、ボールドイタリック。版日付は未確定 |
| S12 | AMS, [Author Handbook for Journals](https://www.ams.org/arc/journals/packages/proc/proc_amslatex/Author_Handbook_Journals.pdf) | 取得部分のみ | §5.8 Roman type。数字・約物・ラベル、演算子名。版日付は未確定 |

S09 の §3.7.4 は全角の等号類・演算記号を扱い、やぐら組分数・根号式・積分・総和などを範囲に含めない。高度な数式の全仕様としては用いない。

S11・S12 は公式サイトの検索取得部分を確認したが、PDF 全文の取得は成功していない。読めた規則だけを仮記録し、出版方針を採用する段階で原文・版を再確認する。

## 科学技術の記法

| ID | 資料・版 | 確認状態 | 参照箇所・用途 |
| --- | --- | --- | --- |
| S13 | BIPM, [The International System of Units, 9th edition, version 4.01 EN](https://www.bipm.org/documents/d/guest/si-brochure-9-en-pdf), June 2026。[改訂履歴](https://www.bipm.org/fr/si-brochure-9) | 本文 | §5.2、§5.4.1、§5.4.3–5.4.4。物理量・単位、数値と単位の間隔、角度・温度の例外 |
| S14 | NIST, [Guide to the SI / SP 811, Chapter 10](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-10-more-printing-and-using-symbols-and-numbers), 2008 edition のオンライン版 | 本文 | §10.2.1–10.2.3。物理量、説明添え字、数学定数・微分記号の書体方針 |
| S15 | NIST, [Guide to the SI / SP 811, Chapter 7](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-7-rules-and-style-conventions-expressing-values), 同上 | 本文 | §7.2。数値と単位、平面角と摂氏温度の空き |

SI に関する現行の参照は S13 とする。S14・S15 は比較用の従来の公式ガイドであり、現在の SI 定義を確認する代わりには用いない。

## 実装側の改行と、本文未確認の規格

| ID | 資料・版 | 確認状態 | 参照箇所・用途 |
| --- | --- | --- | --- |
| S16 | MathJax, [Automatic Line Breaking, 4.0 documentation](https://docs.mathjax.org/en/latest/output/linebreaks.html) | 本文 | Display breaking / In-line Breaking。v4 の折返し、SVG の複数断片、行内では候補の good/bad 評価が反映されない制限 |
| S17 | 日本規格協会, [JIS X 4051:2004 日本語文書の組版方法](https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+X+4051%3A2004) | 書誌のみ | 公式書誌では有効、確認日 2023-10-20。本文未確認。JLREQ と同一視しない |
| S18 | ISO, [ISO 80000-2:2019 Quantities and units — Part 2: Mathematics](https://www.iso.org/standard/64973.html) | 書誌のみ | Edition 2、corrected version 2021-11、確認時の段階 90.92。記号・意味・使用法。本文未確認 |

S16 の `latest` は変動する URL である。今回の参照はページに表示された 4.0 文書。SUUSHIKI の採用バージョンを決めた際に、バージョンと出力方式を固定して実測する。

S17・S18 から条文や細かな空き量を推定しない。ISO 系の書体比較は S04・S14 の記述として扱い、S18 の直接引用に置き換えない。

## 次に読む対象

- S01 の分数・根号・添え字の計算と、S05 の対応アルゴリズムを必要な構造ごとに比較する。
- S11・S12 の全文と版を確定する。出版方針の比較範囲を拡張する。
- S17・S18 は必要な章を閲覧できた時点で本文確認に進める。
- stone-engine.js は [固定コミットの実装確認](stone-engine.md) を追加した。文字列の公開入口に外部 inline box を渡す引数は見当たらないが、内部の配置データは公開されている。接続の実証と MathJax の寸法 API は [Gate 0](../research-plan.md) の残りの調査対象。
