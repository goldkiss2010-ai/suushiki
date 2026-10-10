# 調査方法・測定環境・証拠の所在・再現手順

> **v0.1の保存先**：GitHub Actionsの期限付き成果物から復元した3本の実測データとスクリーンショットは、[v0.1の永続保存ZIP](https://github.com/goldkiss2010-ai/suushiki/releases/tag/v0.1)にまとめました。元JSONのSHA-256と観測件数を検査したうえで凍結しています。[凍結版の説明](v0.1-freeze.md)。


**検索語**：SUUSHIKI再現／日本語組版実測／Chromium／Playwright／MathJax／Stone／禁則プローブ／JSON／行頭位置／バージョン／データの出典／CSS比較／測定の限界。

ここでは現時点の既知の衝突について、**何を測ったか・どの時点の環境か・どの証拠が残っているか**を整理します。新しい事例の発見や機能実装は対象としません。

## 1. 出典は3種類に分ける

**規範・公式資料**：組版上の要件・仕様がどう書かれているかを示す。現行のブラウザーにおける実装や、ある出力の美しさを証明しない。

- [W3C 日本語組版処理の要件（JLREQ）](https://www.w3.org/TR/jlreq/)：行頭禁則、行末禁則、括弧・句読点の処理。文書自体にも慣行上の選択肢がある。
- [W3C CSS Text Module Level 3](https://www.w3.org/TR/css-text-3/)：改行機会、atomic inline、line-breakの厳しさ。Web互換性を意図した規則を含む。
- [MathJax 4 自動行分割の公式資料](https://docs.mathjax.org/en/stable/output/linebreaks.html)：ブラウザー主導の行内数式改行、複数SVG片の生成。
- [MathJax SVGの公式資料](https://docs.mathjax.org/en/latest/output/svg.html)：SVGの特性と通常テキストのコピーとの相違。
- [LuaTeX-ja／jlreqの参照](../latex-benchmark.md)：TeX測定に使用したバージョンと設定。

**既存の研究・ソース調査**：[18件の文献台帳](../math-typesetting/sources.md)、[39件のルール](../math-typesetting/rules.md)、[32件の入力候補](../../examples/math-typesetting-cases.md)、[Stoneのソース調査](../math-typesetting/stone-engine.md)。文献の「本文」「取得部分」「書誌」の確認状態を区別しているため、全18件の全文を確認したとの主張ではない。32件の候補をすべて実行したとの主張でもない。

**独自の実測・コード**：このリポジトリのMathJax、Stoneアダプター、HTML比較、ChromiumとLuaLaTeXの測定値。再現条件を伴う局所的な観測であり、上記の規範とは別に扱う。

## 2. 実測の環境と実行回数

| 既存実験 | 実行した入力と幅 | 数 | 何を観測したか |
| --- | --- | ---: | --- |
| 4系統比較 | T02c/T03a/T04/T06a × 160/240/480px | **12条件** | HTML数式の非分割／MathJax行内改行／Stone候補／SUUSHIKI、幅・行高・断片数 |
| 行端1pxスイープ | T02c/T03a/T03b × 幅90～260px（171値）× HTML文字間隔の2設定 | **1,026条件** | DOM Rangeからの行端・原文位置と禁則プローブ、Stone候補との比較 |
| atomic inline分離 | T03a/T03b × 幅115～190および220～235px（92値）× 8構造 × CSS line-break 2設定 | **2,944条件** | MathJax固有か、同寸法inline-blockで再現するか、nowrapやグループ化での幅超過 |
| TeXの比較 | 10pt、jlreq、12zw/24zwなど保存された原稿 | 限定条件 | 和欧文間の伸縮アキ、LuaLaTeXの式と文章の総幅・段落行数 |

Chromium測定：Playwright 1.55.1／Chromium 140.0.7339.186／GitHub Actions Ubuntuランナー。Node 24。npmの依存はStoneエンジン0.2.0、MathJax 4.1.3。幅はCSS px。和文フォントはCSSのsans-serif指定によるシステムフォールバックで、固定された同梱和文フォントではない。**他のOS・ブラウザー・書体へ検出幅をそのまま一般化しない。**

これらは異なる実験の条件数です。**12＋1,026＋2,944という数字は「4,000種類近い独立したバグ」を意味しません**。幅を1px刻みで変えた同種の原稿を反復測定しています。

## 3. 当時の実行コミットとCIログ

下のリンクは**当時実行した既知の測定**への参照です。mainの新しいコミットや将来の依存更新により、測定結果は変わる可能性があります。

| 実験 | コードを追加・確認したPR | GitHub Actionsの実測実行 |
| --- | --- | --- |
| 4系統比較 | [PR #6](https://github.com/goldkiss2010-ai/suushiki/pull/6) | [ブラウザーCI #38091544273](https://github.com/goldkiss2010-ai/suushiki/actions/runs/38091544273) |
| 1px行端スイープ | [PR #7](https://github.com/goldkiss2010-ai/suushiki/pull/7) | [ブラウザーCI #38092208319](https://github.com/goldkiss2010-ai/suushiki/actions/runs/38092208319) |
| CSS atomic inline切り分け | [PR #8](https://github.com/goldkiss2010-ai/suushiki/pull/8) | [ブラウザーCI #38093345109](https://github.com/goldkiss2010-ai/suushiki/actions/runs/38093345109) |

当時の主要なJSONファイルは、それぞれのブラウザーCIが生成した GitHub Actionsのartifact「suushiki-document-screenshots」内にあります。**Actions artifactは永続保存の仕組みではなく、保存期限（このワークフローは7日）後にはダウンロードできません。** そのため、重要な数値・入力・結果の読み取りをこのリポジトリの日本語Markdownに明記し、artifactだけに依存しないようにしています。

取得済みのJSONを手元で照合するためのSHA-256（UTF-8ファイル全体、当時ダウンロードしたもの）：

| ファイル | 観測レコード数 | SHA-256 |
| --- | ---: | --- |
| suushiki-four-way-matrix.json | 12 | d6229023a2a27312217d7f90b16bdbf087e4e0d7089c2edcd89580852e65006e |
| suushiki-line-edge-sweep.json | 1,026 | 2cdaa327d3d648897dba1c136fbfdf07f781c1cb430bfaf3c4e982ba91ae4ee1 |
| suushiki-css-isolation.json | 2,944 | 59891d5310e2852497fd929969d2e8f9e1549b9ddb31a74b0094f4ac6cfe1758 |

上の値は実測時の取得物に対するハッシュです。**別ブラウザー・別フォントで再実行したJSONのSHAまで一致する必要はありません**。再現性は条件・原文・観測方法を揃えて判断します。

また、検索や第三者の簡易確認に必要な代表ケースは、[永続的に残す短い機械可読サンプル](verified-samples.json)にも転記します。正確な一連の操作が必要なら元コード・当時のCIを参照してください。

## 4. ローカルで既知の実験を再現する

Windows PowerShellでリポジトリのルートを開き、Node.js 24を使用：

    npm ci
    npm test
    npm run dev

ブラウザーで http://127.0.0.1:5173/document.html を開き、次の既存例を選びます。

- T02a・T02b・T02c：数式境界のアキ／空白／句読点
- T03a・T03b：数式直後の句点と括弧の禁則。幅125px、157px、160px付近が過去の測定例（環境に依存）
- T04：高い分数の固定行送りと内容対応行送り
- T06a：非分割数式の幅不足とMathJaxの式内改行
- T07：原文・数式TeX・配置のソース対応

ブラウザーでの操作に加え、CIと同じ詳細な自動測定をローカルで再実行するにはPlaywright/Chromiumが必要です。検証の際に使ったコマンド：

    npm install --no-save --package-lock=false playwright@1.55.1
    npx playwright install chromium
    node scripts/browser-smoke.mjs

ブラウザーの依存が満たされ、ポート5173が空いていることが前提です。詳細なスクリーンショットとJSONはartifacts/に生成されます。**新しい衝突を探すためではなく、記載の既存ケースを再計測するための手順**です。

TeXの別環境比較は[LuaLaTeX実測手順](../latex-benchmark.md)を参照。TeX環境なしでも、保存済み測定ログの読み取り・単体テストは可能です。

## 5. 判定の最低限の注意

- 禁則プローブの違反数は、**Stoneの文字分類に対する一致・不一致**であり、あらゆるJLREQの水準に対する適合判定ではない。
- Stone候補は**純粋なStone単体ではない**。SUUSHIKIによる数式アダプターを通す。
- CSS line-break:strict指定が効かなかった2つの原稿の結果を、全Web文書へ一般化しない。
- 文字「式」に置換した比較は、実際の数式と文字幅が変わる。**同寸法inline-blockこそ幅を揃えた切り分け**である。
- DOM Rangeが返す矩形は、実際の字形のインクの境界ではない。数式が内部改行すると、単一の基線とみなす測定法は適用外となる。
- MathJaxの複数SVG**断片数≠行数**。
- SVG表示は読み上げ・コピー・文書の意味保持の保証ではない。
- 幅不足と禁則衝突は別々に判定する。禁則を守るために横へはみ出しても、単純に改善とは呼ばない。

## 6. 記録を改訂するときの原則

実測と文献上の記述、推論を分けて書く。各数値にはケースID、幅、文字サイズ、環境、比較対象、確認できなかったことを添える。過去の測定を無言で上書きせず、変更の理由と新しい版を記す。

**この記録の主目的は、衝突を増やすことでも、SUUSHIKIの正当性を証明することでもない。** 現時点で既知のケースを再発見せずに参照できるようにすることです。
