# LuaLaTeX / jlreq と SUUSHIKI の再現可能な比較

## 何を実測したか

標準の LuaLaTeX、jlreq クラス 10pt、既定の書体を用いて、以下を lualatex で実際に組版した。実行用ソースは benchmarks/latex/reference.tex、計測タグは benchmarks/latex/reference-log.txt、数値と環境は public/latex-reference.json にある。

実測した環境：
- LuaHBTeX 1.18.0（TeX Live 2025/dev/Debian）
- jlreq クラス 2024/10/04
- 本文 10pt、和文全角幅 zw = 10pt
- 数式外周 mathsurround = 0pt
- 和欧文字間 xkanjiskip = 2.5pt plus 2.5pt minus 1.25pt
- 和文文字間 kanjiskip = 0pt plus 2.5pt（この環境の設定値）

xkanjiskip は一つの固定長ではなく、自然幅・伸長・縮小の3成分を持つ。これを「自然幅 0.25 zw / 伸長 0.25 zw / 縮小 0.125 zw」と無次元化して比較する。ここでの zw は TeX が使用した和文全角幅であり CSS em と同一と仮定しない。

## 全幅の検証

原文に半角スペースのない以下の T02a を hbox に組版した。

    関数\(f(x)=x^2\)を考える。

同じ環境で取得した寸法：

| 測定対象 | LuaLaTeX 幅 |
| --- | ---: |
| 全体 | 113.00021 pt |
| 左の本文「関数」 | 20.00000 pt |
| 数式のみ | 43.00021 pt |
| 右の本文「を考える。」 | 45.00000 pt |
| 全体 − 3項目の和 | 5.00000 pt |

この 5pt は左右合計の生成間隔として、両側 2.5pt という xkanjiskip の自然幅と一致する。単に設定を読み取るだけでなく、組版後の寸法からも再確認できる。

T02b（原文に半角スペースあり）の全幅は 114.66022pt、T02c（句読点・括弧と数式3個）は 133.56717pt。どちらも原文全体の幅であり、句読点別の個々の空きや MathJax のSVG幅を直接検証する値ではない。

12zw と24zw の2種類の hsize で T02a を2回連続させた段落も実際に測定し、それぞれ 2行、1行になった。空白あり T02b を12zwで2回続けた場合は2行。これはこの TeX バージョン・書体・行分割アルゴリズムでの結果である。

## 使い方

ブラウザー：/document.html で「T02d LaTeXの行数比較（2文）」を選び、文字サイズ 20px、幅240pxまたは480pxにすると、12zw・24zwの **名目上** 同じ比率での行数が並ぶ。数式外側のアキには none、quarter、contextual に加え、elastic（試験）を選べる。

elastic は自然幅0.25 CSS em、伸長余地0.25 CSS em、縮小余地0.125 CSS em を「数式の左右の境界」ごとに記録する。元原文のスペース、句読点の除外、行端での削除は contextual と同じ条件で扱う。ただし、**現状の行分割・配置は自然幅だけを使用する。伸縮による実際の均等配置や Knuth–Plass 型の最適化は実装していない**。

各行の未使用の伸縮余地は JSON の summary.elasticBudgets、数式左右の指定値と適用値は summary.geometry[].boundary に出力される。report 内の appliedAdjustment は現在は常に0で、伸縮したことを示す値ではない。

TeX のインストールがある環境では、次のコマンドで本当に lualatex を再実行し、保存している測定値との差と内部整合性を確認できる。

    npm run bench:latex

同じ環境で幅のドリフトをエラーにしたい場合：

    npm run bench:latex -- --strict

意図して参照値を更新する場合のみ：

    npm run bench:latex -- --write

lualatex、jlreq および amssymb が必要。Node.jsのみの環境でも npm test により保存された実測ログと数値を照合する。GitHub Actions の通常テストでは TeX 全体のインストールは行わず、実ブラウザーの MathJax と比較モジュールを検査する。GitHub の Actions から「Reproduce LuaLaTeX reference」を手動実行すると、別ジョブで TeX Live を導入し、実際の TeX バージョン・測定値・保存スナップショットとの差を artifact に残す（ランナーのフォント差により数値が異なる場合がある）。

## 解釈してはいけないこと

- LaTeX の pt と画面の CSS px をそのまま一致させない。TeX の zw と CSS em は別の尺度。
- jlreq の TeX 数式フォントと MathJax SVG の数式フォント、本文の和文フォントが一致するとは限らない。行数・式幅が違ってもただちに不具合とはいえない。
- xkanjiskip の設定値は、あらゆる数式・約物境界で同じ実幅が入る保証ではない。JFM、禁則、明示空白、箱の種類などを含む検証が今後必要。
- ここでの elastic は TeX の glue データモデルに着想を得た試験モードであり、LaTeX を完全再現する互換モードではない。
- 一致する組版原理と、知覚的に好ましいアキを同一視しない。最終的な印刷品質・アクセシビリティ・文字間の光学的な調和は別の課題。

参考：jlreq の公式マニュアル https://github.com/abenori/jlreq 、LuaTeX-ja 仕様 https://ctan.org/pkg/luatexja 。

## 次の研究上の境界

柔軟な glue を実際の伸縮処理に参加させるには、行ごとの目標長と余剰量の定義が必要。文中のスペース、約物のJFM、欧文単語や数式内部の空白と組版側の境界アキを同じ予算へ無差別に混ぜないこと。その上で、左寄せ・均等配置・最適改行を別々の選択として導入する。
