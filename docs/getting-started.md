# 環境構築と実行手順

最初の対象は、Stone の和文段落と MathJax の数式を**別々に表示・計測する確認画面**です。共通の行分割への接続は次の段階です。

## 1. 必要なもの

Windows / PowerShell を前提にしています。

| 必要なもの | 用途 |
| --- | --- |
| [Node.js 24 LTS](https://nodejs.org/en/download) | ローカルサーバーと npm。Windows 用 Installer を使用する |
| [Git for Windows](https://git-scm.com/install/windows) | リポジトリの取得・更新。導入済みなら再インストール不要 |
| Edge または Chrome | 組版の表示と寸法の測定 |

Node.js のインストール後は PowerShell を開き直し、確認します。

```powershell
node --version
npm.cmd --version
git --version
```

`node` が `v24.x.x`、残りもバージョン番号を返せば先に進めます。PowerShell では `npm.cmd` を使うため、`npm.ps1` の実行ポリシーを変更する必要はありません。

## 2. リポジトリを取得

既にローカルにある場合は Git GUI で最新の `main` を取得し、そのフォルダーを PowerShell で開きます。作業中の変更がある場合は保持してください。

初めて取得する場合は、以下でユーザーフォルダー内の `Projects` に置けます。

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\Projects" | Out-Null
Set-Location "$env:USERPROFILE\Projects"
git clone https://github.com/goldkiss2010-ai/suushiki.git
Set-Location .\suushiki
```

GitHub の認証を求められたら、このリポジトリにアクセスできるアカウントで認証します。Git GUI からの Clone でも構いません。

## 3. 依存ライブラリを導入

`package.json` と `package-lock.json` があるフォルダーで実行します。

```powershell
npm.cmd ci
```

初回はインターネット接続が必要です。直接の依存は Stone `0.2.0` と MathJax `4.1.3`。数式フォントを含む実際の依存バージョンはロックファイルで固定しています。

この画面は Node.js の標準 HTTP サーバーを使います。別のビルドツールやコンパイル作業は不要です。

## 4. 起動

```powershell
npm.cmd run dev
```

次の表示が出たら、ブラウザーで [http://127.0.0.1:5173/](http://127.0.0.1:5173/) を開きます。

```text
SUUSHIKI: http://127.0.0.1:5173
Stop with Ctrl+C.
```

PowerShell は起動したままにしておきます。画面上部に「単体確認 OK」と出れば両エンジンの変換・計測が完了しています。ライブラリと数式の追加フォントはローカルから配信します。

## 5. 順に確認する

1. 初期値の幅 `480 px`、文字サイズ `20 px` で、和文と４つの数式が表示されることを確認する。
2. 幅を `160 px` に変える。Stone の行数が増え、句読点・括弧の位置と文字枠が変わることを観察する。
3. 文字サイズを `24 px` に変える。数式の幅・上側・下側が再計測されることを確認する。
4. ゴシック／明朝を切り替え、再計測が完了することを確認する。
5. 「現在の測定結果を JSON で保存」を押し、`suushiki-measurements.json` を保存する。

異常があれば、幅・文字サイズ・フォント・ブラウザーと、保存した JSON を記録してください。OS 標準フォントを使うため、別の OS の測定値と完全一致することは合格条件ではありません。

数式の `width` / `height` は表示された SVG の矩形、`ascent` / `descent` はゼロ高さのインライン要素で得たベースラインから矩形の上下端までの距離です。単位は CSS px。字形のインク領域やフォント自体の ascent / descent とは区別します。青線がベースラインです。

この段階の数式は `display: false`、自動の行内改行を無効にしています。４例で SVG が１つであることは確認しますが、あらゆる TeX 入力が分割されないことを保証するものではありません。数式軸の測定・和文とのベースライン調整は接続段階で検証します。

## 6. 終了・再起動・コード変更

PowerShell で `Ctrl+C` を押すと終了します。次回は同じフォルダーで `npm.cmd run dev` を実行します。

画面のコードは `public/`、サーバーは `scripts/serve.mjs` です。画面のコード変更後はブラウザーを再読み込みします。サーバーの変更後は停止して起動し直します。依存やロックファイルの更新後は `npm.cmd ci` を再実行します。

## 起動できないとき

| 症状 | 対処 |
| --- | --- |
| `node` / `npm.cmd` が見つからない | Node.js の導入と PATH を確認し、PowerShell を開き直す |
| `package.json` がない | `Set-Location` でリポジトリのフォルダーへ移動する。最新 `main` を取得できているかも確認する |
| `npm ci` が失敗する | npm のエラー本文を記録し、通信・プロキシ設定と Node.js の版を確認する |
| ポート `5173` が使用中 | 下のようにポートを変更し、`http://127.0.0.1:5174/` を開く |
| 画面が読み込み中のまま／エラーになる | `npm.cmd ci`、サーバー再起動、ブラウザー再読み込みを行う。解消しなければブラウザーの開発者ツールの Console を記録する |

```powershell
$env:PORT = "5174"
npm.cmd run dev
```

## 今回の確認範囲

依存導入、ローカル HTTP 配信、和文の再組版、４式の SVG 表示・寸法測定、条件変更と JSON 保存を確認するための構成です。実測結果は [standalone-check.md](standalone-check.md) を参照してください。

和文中への数式の接続、７つの衝突ケースの解決、図表配置、統合したコピー・アクセシビリティは未実装です。次は寸法が既知の仮の数式ボックスを行分割に参加させ、実際の MathJax 出力に置き換えます。
