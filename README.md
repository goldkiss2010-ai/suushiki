# SUUSHIKI / 数式

**調査記録 v0.1（2026年10月11日凍結）**：既知のK01〜K07について新しい衝突の探索・機能追加を停止しました。[凍結版の対象と限界](docs/research/v0.1-freeze.md)／[GitHub Release：測定JSON・スクリーンショットの永続アーカイブ](https://github.com/goldkiss2010-ai/suushiki/releases/tag/v0.1)。これ以降は誤記・リンク・データ保全の修正を中心とします。


**日本語と数式の組版で起こる既知の衝突を、出典・実験条件・測定結果・未確認事項とともに日本語で残す調査プロジェクト。**

主目的は新しい組版エンジンやサービスの開発ではありません。日本語本文に行内数式を挿入したとき、既存のHTML/CSS、MathJax、Stone、LuaLaTeXなどで何が起こるかを整理し、同じ問題を後から調べる人が日本語で検索して到達できる**参照可能な調査記録**を作ることです。

現時点では、すでに整理した7種類の問題（K01〜K07 / T01〜T07）の範囲に集中します。新しい衝突を探したり、検出件数を増やしたりすることは目的にしていません。SUUSHIKIの実装は、記録に必要な既知の入力を再表示・比較・測定するための道具です。

## 日本語の調査記録を読む

**[日本語調査記録の総合入口：既知の問題・用語・確定事項・未検証事項](docs/research/README.md)**

| 探している問題・キーワード | 日本語解説 |
| --- | --- |
| **数式の直後に句点が行頭に来る／括弧だけが行末に残る／禁則処理／MathJax／atomic inline／CSS inline-block／nowrap** | [数式と日本語の禁則・括弧の実測と原因分離](docs/research/01-kinsoku-atomic-inline.md) |
| **分数の高さ／数式のベースライン／行送り／行ボックスの重複／長い数式の折り返し／MathJax 4の式内改行／横はみ出し** | [高い数式・式内改行・幅不足の実測](docs/research/02-line-height-and-overflow.md) |
| **本文と数式の空白／和欧文のアキ／約物詰め／四分アキ／xkanjiskip／LuaLaTeX／jlreq／TeX** | [数式内部と本文の境界・アキの実測](docs/research/03-math-boundary-spacing.md) |
| **数式SVGとコピー／TeX原文の保存／読み上げ／選択／MathML／アクセシビリティ** | [ソース保存・意味・アクセシビリティの確認範囲](docs/research/04-source-and-accessibility.md) |
| **再現手順／Chromium／Playwright／検証コード／測定環境／JSON／証拠の出典** | [実験条件・実行記録・データの証拠](docs/research/05-method-and-evidence.md) |

[収集した既存資料18件](docs/math-typesetting/sources.md)と[39項目のルール](docs/math-typesetting/rules.md)、[32件の未全面検証の入力候補](examples/math-typesetting-cases.md)も公開しています。出典の確認範囲を区別し、検証していないことを検証済みと書かない方針です。

## これまでの主要な実測

- 日本語の句点・括弧と行内数式の接点：**1,026条件**の行端位置を測定し、禁則プローブに引っかかる幅を記録。
- 素の文字／同寸法のCSS inline-block／MathJax数式／nowrap等の切り分け：**2,944条件**。MathJaxだけが問題を起こすとはいえず、atomic inline周辺の改行機会が説明候補になった。
- 高い分数の固定行送りと可変行送り、長い数式の内部改行：**12条件**の4系統比較。MathJaxの既存の行内数式改行が、SUUSHIKIの非分割方式より有利な例も保存。
- LuaLaTeX＋jlreq：**具体的なTeXバージョン・原稿・数値付きの実測**を保存。WebのCSS emとTeXのzw/ptを同一視しない。

これらは独立した「4,000件のバグ」ではありません。固定した文章・文字サイズで幅や処理方法を変えた反復観測です。また、通常HTMLとの差は直ちにブラウザーバグやJLREQ違反を意味しません。[実測をどう解釈すべきか](docs/research/05-method-and-evidence.md)を併せて参照してください。

## 実験器具の実行（開発は主目的ではありません）

Node.js 24と、npmが使用できる環境でリポジトリのルートから実行します。

```powershell
npm ci
npm test
npm run dev
```

ブラウザーで **http://127.0.0.1:5173/document.html** を開きます。既存のT01〜T07入力を選び、表示幅・日本語約物・数式の外側のアキ・行送り・MathJaxの折返し・CSS atomic inlineを比較します。原文と幾何情報をJSONへ保存できます。単一数式の初期実験は http://127.0.0.1:5173/ です。終了は実行中のPowerShellでCtrl+C。

[Windows PowerShellでのセットアップ](docs/getting-started.md)、[ワークベンチの操作方法](docs/document-workbench.md)、[テスト対象と未実装事項](docs/collision-matrix.md)、[CIによる実測の根拠](docs/research/05-method-and-evidence.md)。

## 調査上の前提と限界

SUUSHIKIは**日本語・数式の一体組版の完成品ではありません**。現行の検証描画にはSVGが多く、読み上げ、全文章の直接選択、数学軸・グリフインクの厳密比較、全プラットフォームでの文字組み、有限高さの省略・縮小、出版品質の判定などは保証していません。

比較に用いた「Stone候補」は、Stoneの日本語組版をSUUSHIKIの計測済み数式アダプターに接続した条件です。Stoneの独立した動作やStoneに欠陥があることを直接示すものではありません。また、MathJaxが既に持つ行内数式改行などの機能は、欠点を隠さず対照として記録します。

現在の活動は**既知の問題の事実関係・出典・環境・測定の限界を明瞭にすること**であって、未知の衝突の探索・外部へのIssue報告・製品ロードマップの作成ではありません。

## 依存・謝辞・ライセンス

本プロジェクトは独立した非公式の実験記録であり、以下の公式プロジェクトから承認・支援されているものではありません。

- [stone-engine.js](https://github.com/non-standardworld/stone_engine_js) — npm 0.2.0、MIT
- [MathJax](https://github.com/mathjax/MathJax) — npm 4.1.3、Apache-2.0
- MathJax New Computer Modern font 4.1.3 — Apache-2.0
- [W3C JLREQ](https://www.w3.org/TR/jlreq/)／[CSS Text Level 3](https://www.w3.org/TR/css-text-3/) — 日本語組版要件・CSS仕様の参照

依存ライブラリの正確な固定版はpackage-lock.jsonへ。引用・再配布時は原資料・プログラム・フォントそれぞれの権利表示を確認してください。

**リポジトリ独自のライセンスは未選択**です。依存ライブラリがMIT等であることを理由に、このリポジトリ全体を同じ条件で再利用できるとみなさないでください。

過去の実装方針と開発計画はGit履歴、および[当初の研究計画](docs/research-plan.md)、[技術仮説](docs/architecture.md)に保存しています。これらは今の目標を定める文書ではありません。
