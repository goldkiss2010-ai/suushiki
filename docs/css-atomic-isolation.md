# CSSのインライン要素と日本語禁則：SUUSHIKI比較実験

> **資料の位置付け**：これは2026年10月11日に実施した既知のT03a・T03bの原因切り分け結果です。調査全体での意味と未確定事項は[数式と日本語の禁則の日本語解説](research/01-kinsoku-atomic-inline.md)に統合しました。「次の開発判断」は当時の考察として残しています。


2026-10-11 / SUUSHIKIのT03a・T03bをChromium 140で比較しました。
この資料は**外部にバグ報告するためではなく、独自組版処理の要否を判定するための内部実験**です。

## 実験条件

各条件で同じ日本語本文を使い、数式部分のHTML構造だけを変えました。
横幅は115〜190px（1px刻み76幅）および220〜235px（16幅）の計92幅。
2つの原稿 × 8種類の構造 × CSS line-break 2方式 × 92幅
＝合計2,944観測を実際のChromiumで測定しました。

数式を文字に置き換える条件は**元の数式とは幅が違う**ため、
「数式と等価な対照」ではなく、独立した要素でないときに何が起きるかを探す条件です。
同寸法inline-block条件は、MathJaxから測った数式の幅・高さ・基線位置を使います。
横幅を超えたかどうかも記録し、禁則プローブの検出数だけを最適化しません。

| 対照 | 何が違うか |
| --- | --- |
| flat-text | 数式を文字「式」に置換して、段落の普通のテキストと一体化 |
| inline-text | 文字「式」を別のinline spanに入れる。独立したボックスではない |
| atomic-box | MathJaxと同寸法の普通のinline-block |
| mathjax | 実際のMathJax 4の一体SVG |
| atomic-nowrap / mathjax-nowrap | 隣接する括弧・句点と式を、white-space:nowrapのinline span内にまとめる |
| atomic-group-box / mathjax-group-box | 隣接する括弧・句点と式を、inline-blockでまとめる |

それぞれ、CSS line-break:auto と strict を切り替えました。
禁則検出は既存のStoneの文字集合を共通プローブとして適用したものです。
これはJLREQ完全準拠の判定ではありません。

## 実測結果

| 原稿と条件 | 禁則プローブあり | 横はみ出しあり |
| --- | ---: | ---: |
| T03b（括弧）のflat-text / inline-text | 0 / 92幅 | 0 / 92幅 |
| T03b（括弧）のatomic-box / MathJax | 91 / 92幅 | 0 / 92幅 |
| T03b（括弧）のnowrap / group-box | 0 / 92幅 | 18 / 92幅 |
| T03a（句点）のflat-text / inline-text | 0 / 92幅 | 0 / 92幅 |
| T03a（句点）のatomic-box / MathJax | 5 / 92幅 | 0 / 92幅 |
| T03a（句点）のnowrap / group-box | 0 / 92幅 | 0 / 92幅 |

各行の値はline-break:autoとstrictで同じでした。
T03aの問題幅は155〜159px、T03bのnowrap横超過は115〜132pxです。
この観測では**MathJaxの固有描画処理より、atomic inlineがもたらす改行機会の方が説明力が高い**と考えられます。

CSS Text Level 3は、Web互換性のためatomic inlineの前後に改行機会を置く規則を説明しています。
https://www.w3.org/TR/css-text-3/#line-breaking

ただし、CSSの故障を実証したわけではなく、仕様で認められた配置と日本語の禁則プローブが
一致しない例を具体的に再現したものです。

## なぜnowrapだけで完成ではないか

T03bの125pxでは、MathJaxの数式そのままだと、直前の開き括弧が行末に残ります。
nowrapで開き括弧＋式＋閉じ括弧を束ねれば、括弧を含むまとまり全体が次行に移ります。
ところがそのまとまり自体の幅が125pxを超え、横へはみ出します。

反対にT03aの157pxでは、数式＋句点をnowrapで束ねると、
今回の幅範囲では禁則プローブが解消し、横はみ出しも発生しませんでした。

したがって、**局所的なCSSだけで十分な条件と、行幅全体の調整や別の折り返し方法が必要な条件は異なります**。

## 次の開発判断

1. 問題をMathJax固有と考えて修正する必要は、少なくとも今回の2原稿からは見いだせません。
2. 数式と句点の直後問題は、HTML側の局所的なnowrapによって十分改善する条件があります。
3. 括弧と式全体の幅制約が衝突した場合、nowrapは禁則を回避しても横幅超過を生みます。このときSUUSHIKIの再分割が有用な場合があります。
4. 今後は横幅超過を許さない局所的なCSS構造の選択、式内改行との併用、原文のアクセシビリティを確認すべきです。

## 再現

SUUSHIKIの document.html で数式1つのT03a/T03bを選び、
「CSS実験：数式を文字や同寸法のインライン要素に置き換える」を開きます。
幅・CSSの厳しさ・数式の代替方法を変えて、行端と横はみ出しを観察できます。

GitHub ActionsのChromium CIは scripts/browser-css-isolation.mjs を実行し、
artifacts/suushiki-css-isolation.json と2枚の比較スクリーンショットを保存します。
CIが示すのは特定のChromium・フォントでの再現性であり、ブラウザー一般の保証ではありません。
