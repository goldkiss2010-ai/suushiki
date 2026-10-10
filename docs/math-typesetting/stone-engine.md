# Stone Engine：継承する思想と現行実装の確認

確認日：2026-10-10。対象は JavaScript 移植版 `non-standardworld/stone_engine_js` のコミット [`79a07777bcec540d94c5bd5304a68e427a1f49e6`](https://github.com/non-standardworld/stone_engine_js/tree/79a07777bcec540d94c5bd5304a68e427a1f49e6)。[package.json][package] の宣言は `0.2.0`。npm 公開版と一致するかは未確認。

以下は README とソースを読んだ結果で、統合後の表示・性能・コピーを実測した結果ではない。Swift 原版の方針、移植版の実装、SUUSHIKI の提案を区別する。

## 継承する思想

[原版の方針][original] は、日本語の約物・禁則・文字種ごとのサイズを細かく扱うこと、画面幅の変更やスクロールに対応すること、内部の配置情報にアクセスできること、実行速度を重視することにある。

SUUSHIKI では、この方針を次のように引き継ぐ。

- 本文の約物処理・禁則・文字寄せを参照し、数式を加えたときの境界規則と段落モデルへ発展させる。
- 和文・欧文・数式のフォントとスケールを意図的に指定できるようにする。既存の数値や API は比較の出発点とする。
- 段落幅が変わったら同じ入力を組み直す。数式の内部寸法は再利用できる条件を記録し、境界と行位置を再計算する。
- 本文 run と数式ボックスの位置、寸法、ソース対応を観察できる形にする。
- 数式の再計測を不要に繰り返さない。高速であることの確認は後の実測で行う。

これは SUUSHIKI の設計方針であり、数式ボックスを現在の Stone が受け入れるという意味ではない。

現行実装のコード・API・文字単位のデータ構造・固定行送り・改行位置は必須の保持対象にしない。数式のために項目モデル、境界処理、行ごとの上下寸法、描画とソース対応を拡張できる。adapter、内部拡張、組版層の再構成を同じ確認入力で比較し、思想との関係と変更理由を説明する。

## 実装で確認したこと

| ID | 確認した動作・制約 | 数式を接続するときの含意 | 根拠 |
| --- | --- | --- | --- |
| ST01 | 原版は画面サイズの変更、スクロール、内部情報の公開、速度を重視する | 一段落の再配置と寸法の説明を先に扱う | [原版の方針][original] |
| ST02 | `Run` は書記素単位。座標は y 下向きの CSS px、`position` はグリフ原点・ベースライン、`frame` は占有矩形 | 数式も基線と上下寸法を渡す。インクの外接矩形と `frame` を同一視しない | [types.ts][types]、[layoutRunLrTb][layout] |
| ST03 | `punctuationMode` は `whole` / `half` / `stone`。`stone` は前後の約物で詰め、折返し時には行頭の開き括弧と行末の句読点・閉じ括弧も処理する | 日本語の約物への配慮を継承し、式の外側との境界を定義する。数式内部の括弧・句読点にこの処理を重ねない | [約物分類][punctuation]、[layoutRunLrTb / goNextLineLrTb][layout] |
| ST04 | `parseText` は単語または書記素のトークンを作る。折返しは次のトークン幅を見て、禁則時はトークン単位で戻す。収まらない単語は途中で分かれ得る | 「一つのトークン」だけでは数式の非分割を保証できない。数式の一体性を別に表す必要がある | [parseText][parser]、[goNextCharLrTb / processNotEndingAndStarting][layout] |
| ST05 | 禁則の既定は強い禁則。分離禁止の並びも扱うが、非常に狭い幅などで全部の条件を守れない場合の例外がある | 禁則の目的を式項目へ拡張し、選んだ強さと例外を記録する。式と禁則文字の組が収まらない場合は分けて記録する | [禁則集合][punctuation]、[processNotEndingAndStarting][layout] |
| ST06 | `justify` は最終行・明示改行で終わる行を除く。和文間・和欧境界・空白前後へ余りを均等配分し、連続する欧文間と分離禁止の間は広げない。対象行の行末空白は幅 0 にする | 数式内部は配分対象にしない。本文と式の境界を配分対象にするかは明示する。常時の和欧四分アキをこの実装からは確認できない | [isJustifiableGap / collapseTrailingSpaces / alignLineLrTb][layout] |
| ST07 | 横書きの行送りは `adjustFontSize × lineHeightScale`。和文の既定メトリクスは上 `0.88`、下 `0.12`、欧文の既定スケールは `0.95`。行内は共通基線で置く | 現行 Stone の自動行送りとは区別して、数式の上下寸法を含む行メトリクスと内容に応じる行送りを拡張候補にする | [行送り][context]、[フォント既定値][fonts]、[layoutRunLrTb][layout] |
| ST08 | 領域に完全に収まらない最初の行以後は非表示にし、表示末尾を省略記号にする処理がある。全体縮小はオプションで再計測・再配置する | 数式を一部だけ欠けた正常出力にしない。縮小を選ぶなら式と本文の寸法・描画を同じ倍率で更新する | [updateVisibility][layout]、[adjust / layoutWithScale][engine] |
| ST09 | SVG は段落の `text` と文字ごとの `tspan data-run`。コピー処理は選択した文字 run の `char` を戻す。標準の SVG 出力は `aria-hidden` | 数式の SVG パスを足すだけでは、式を含むコピーや読み上げまで引き継げない。ソース対応と意味を持つ別経路が必要 | [svgString][svg]、[runRangeOfSelection / textOfRunRange][copy]、[README][readme] |
| ST10 | Canvas 計測は送り幅・フォントメトリクスをキャッシュする。フォント読込み後は破棄して計測し直す | 数式もフォント・サイズ・出力方式の変更で寸法を無効化する。幅だけを変えた場合と区別する | [CanvasMeasurer][canvas] |

`0.88 / 0.12` はこの実装の既定値であり、すべての和文フォントの実測値とはしない。`justify` も既定の文字寄せではない。Stone の既定は `leading`。これらの数値や配分規則を SUUSHIKI の不変条件にせず、選んだ設定と変更理由を記録する。

表の「確認した動作・制約」は上流の事実、「数式を接続するときの含意」は SUUSHIKI の提案である。思想の継承へ方針を緩和しても、上流の事実を書き換えて拡張済みとは扱わない。

## ボックスの受渡しに関する確認

公開入口 `layoutText(text, options, measurer, size, spans)` は文字列を解析し、各 run の幅を `measureRuns` で計測する。[公開 export][index] と [型定義][types] に、外部の幅・ascent・descent を持つ inline item を渡す引数は見当たらない。`readStoneSource` もテキストノードと装飾範囲を読むもので、DOM 内の数式要素を測定済みボックスとして取り込まない。[engine.ts][engine]、[readStoneSource][spans]

一方、`StoneContext`、parser、`Layouter` は公開されており、内部データを操作できる。外部 adapter の可能性は残る。ただし、仮の一文字へ幅を入れるだけでは、再計測による上書き、run ごとの高さ、禁則、描画、ソース対応まで解決しない。

次の調査では、数式ボックスの**送り幅・基線・上下寸法・非分割・境界属性**を受け取る契約と、それを行組版へ接続する方法を検証する。既存の本文処理を再利用する案と、項目・行メトリクスを拡張する案を比較する。変更が不要であることは完了条件にしない。採用する実装方式は、この資料だけで確定しない。

数式ボックス全体を「欧文の一文字」と見なすことも、JLREQ の欧字の四分アキを無条件で適用することも、確認した Stone の動作からは導けない。具体的な衝突は [decisions.md](decisions.md)、確認入力は [math-conflicts.md](../../examples/math-conflicts.md) にまとめる。

[original]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/README.original.md
[readme]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/README.md
[package]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/package.json
[types]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/types.ts
[index]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/index.ts
[parser]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/parser.ts
[layout]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/layout.ts
[punctuation]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/punctuation.ts
[fonts]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/fonts.ts
[context]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/context.ts
[engine]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/engine.ts
[svg]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/render/svg.ts
[spans]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/render/spans.ts
[copy]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/render/copy.ts
[canvas]: https://github.com/non-standardworld/stone_engine_js/blob/79a07777bcec540d94c5bd5304a68e427a1f49e6/src/measure/canvas.ts
