# 数式と日本語の禁則処理：句点・括弧・atomic inline

**検索語**：日本語禁則／行頭禁則／行末禁則／数式の直後の句点／数式を囲む括弧／MathJax／CSS atomic inline／inline-block／line-break strict／white-space nowrap／SUUSHIKI。

対象：K03、T03a・T03b、およびT02c。既知の衝突条件を整理した記録であり、新しいブラウザーバグの報告ではありません。

## 1. どの要件が競合するか

JLREQでは、句点・終わり括弧を行頭に置かないこと、始め括弧を行末に置かないことが要件として記述されています。一方、CSS Text Level 3は、Web互換性のため置換要素・atomic inlineの直前・直後に特別な改行機会を与えます。このため、普通の日本語文字と数式の間で、文字だけの文章とは異なる改行候補が生じ得ます。

これは「ブラウザーが仕様に違反した」「MathJaxに欠陥がある」という結論とは異なります。CSSの改行規則と、今回採用した日本語禁則の判定方針が異なることを検証する問題です。

**一次資料**
- [W3C 日本語組版処理の要件（JLREQ）・行頭禁則 3.1.7／行末禁則 3.1.8](https://www.w3.org/TR/jlreq/#characters-not-starting-a-line)
- [W3C CSS Text Module Level 3・Line Breaking](https://www.w3.org/TR/css-text-3/#line-breaking)
- [MDN日本語・CSS line-break](https://developer.mozilla.org/ja/docs/Web/CSS/Reference/Properties/line-break)

## 2. 再現した原稿

既存の実験入力は[public/collision-cases.js](../../public/collision-cases.js)に固定されています。

T03a（式の直後の句点）：

    十分に長い説明の後で\(a+b=c\)。次の条件を考える。

T03b（数式を囲む括弧）：

    この条件は（\(a+b=c\)）で与えられる。

T02c（句読点と複数数式）：

    値\(x\)、\(y\)。また（\(z\)）を用いる。

行端は画面の見た目から手で推測せず、通常HTMLの本文をDOM Rangeで書記素単位に計測し、数式SVGの計測済み上昇寸法から基線を合わせて区分しました。Stone候補・SUUSHIKI側は組版結果の元ソース位置を照合します。判定はStoneの禁則文字集合を共通に適用した「禁則プローブ」です。

## 3. 実測A：1px刻みの行端比較

**観測環境**：Chromium 140（GitHub ActionsのUbuntuランナー、Playwright 1.55.1）、本文20 CSS px、sans-serif。幅90〜260px（171幅）、原稿3種類 × CSS文字間隔モード2種類＝**1,026条件**。この時の数式は非分割SVGであり、式内部の改行は比較対象外です。

| 原稿・幅 | 通常HTML＋MathJaxの観測 | Stone候補の状態 | SUUSHIKIの状態 |
| --- | --- | --- | --- |
| T03a・155〜159px | 数式の直後の「。」が行頭となる | composed、禁則プローブなし | composed、禁則プローブなし |
| T03b・125〜134px | 「（」が行末に残る | constraint-conflict、禁則プローブあり | composed、禁則プローブなし |
| T03b・135〜234px | 禁則プローブが検出される幅が続く | composed、禁則プローブなし | composed、禁則プローブなし |
| T02c・90〜91px | 「）」が行頭に残る | composed、禁則プローブなし | composed、禁則プローブなし |
| T02c・146〜176px | 「（」が行末に残る | composed、禁則プローブなし | composed、禁則プローブなし |

**観測上の要点**：T03b・125pxでは、行頭の原文UTF-16位置が通常HTMLで「0, 6, 16, 21」、Stone候補で「0, 5, 6, 16, 19」、SUUSHIKIで「0, 5, 16, 21」でした。通常HTMLでは行末の「（」が検出され、Stone候補にも検出が残りましたが、SUUSHIKIでは再分割した結果、同じ判定集合による違反が消えました。

T03a・157pxでは、通常HTMLの行頭位置「0, 7, 19, 26」に対し、SUUSHIKIは「0, 7, 10, 22」でした。後者は「。」だけが次行へ孤立する状況を回避していました。

これらは特定環境における**配置の差**であり、どちらが知覚的に美しいかの判定ではありません。また、数式が幅そのものを超える条件ではSUUSHIKIの表示が保留され、正常配置の比較対象から外れます。

実測の詳細：[1pxスイープ当時の検討記録](../line-edge-sweep.md)。

## 4. 実測B：MathJaxに固有の問題なのかを分離する

次に、**新しい衝突を探すのではなく上記2原稿の原因を切り分けるため**、数式部分だけを8種類のDOM構造に置き換えました。

- 普通の日本語「式」へ置換（単一テキスト／別のinline span）
- MathJaxと同じ幅・上昇・下降を持つCSSのinline-block（atomic-box）
- MathJax 4が生成した本物の数式SVG
- それぞれの式と隣接約物をnowrapで包む、またはひとつのinline-blockにする

**条件**：横幅115〜190px（76幅）と220〜235px（16幅）の計92幅、T03a/T03b、8構造、CSS line-break:auto/strictの2指定、**計2,944観測**。以下の値は**autoとstrictの各モードでそれぞれ同じ**でした。

| 原稿・構造 | 禁則プローブ検出 | 横はみ出し検出 |
| --- | ---: | ---: |
| T03b「括弧」＋文字「式」 | 0 / 92幅 | 0 / 92幅 |
| T03b「括弧」＋同寸法inline-block | 91 / 92幅 | 0 / 92幅 |
| T03b「括弧」＋MathJax数式 | 91 / 92幅 | 0 / 92幅 |
| T03b「括弧」＋nowrapで束ねる | 0 / 92幅 | **18 / 92幅** |
| T03b「括弧」＋式全体をinline-block化 | 0 / 92幅 | **18 / 92幅** |
| T03a「句点」＋同寸法inline-blockまたはMathJax | 5 / 92幅 | 0 / 92幅 |
| T03a「句点」＋nowrapで束ねる | 0 / 92幅 | 0 / 92幅 |

T03aの検出幅は155〜159pxです。T03bでは、115〜132pxでnowrapによる横はみ出しが起こりました。**125pxは重要な対照条件**で、MathJax単独では開き括弧が行末に残り、nowrapで包むと禁則プローブは消えるものの、束ねた要素が列をはみ出します。

MathJaxと同寸法の素のinline-blockが全幅で同じ検出件数だったことから、少なくともこの2例では、**MathJax内部の数式描画固有の処理より、atomic inlineに生じる改行機会が主要な説明候補**です。

ただし、文字「式」への置換は数式幅そのものが変化するため、寸法を揃えた厳密な数式対照ではありません。同寸法のinline-blockが、そこを補う対照です。無条件の「nowrapが最適」という結論も誤りです。

実測の詳細：[CSS atomic inline切り分け記録](../css-atomic-isolation.md)。

## 5. 結論の範囲

**確認した事実**
- 特定の狭幅で、通常HTMLと日本語の禁則プローブが一致しないことがある。
- MathJaxと同寸法のinline-blockで、同じ傾向を再現した。
- CSS line-break:autoとstrictでは、今回の92幅の検出数は変わらなかった。
- nowrapの局所的な対処は、T03aでは有効だが、T03bでは幅制約と競合する条件がある。
- SUUSHIKIの再分割は、T03b・125〜134pxでStone初期候補からの違いを示した。

**確認していないこと**
- 全ブラウザー・全フォント・全数式についての一般化。
- CSS仕様違反、MathJaxのバグ、Stone本体の欠陥、JLREQ全体の適合判定。
- SUUSHIKIの組版が一般的なHTMLより常に美しい、読みやすい、または実用上優れるという結論。

**現時点での解釈**：この衝突は、数式内部を正しく描くことだけでは解けない、段落・行幅・約物・atomic inlineの接続問題です。ただしHTMLとCSSによる設計上の代替策も実在し、どこまで独自組版が必要かは未確定です。

## 6. 追試への入口

[再現手順・環境・測定JSON](05-method-and-evidence.md)を参照してください。既存のworkbench（document.html）のT03a/T03bと「CSS実験」だけで、同じ原稿を再表示できます。新しい衝突の探索や外部Issue投稿はこの記録の対象外です。
