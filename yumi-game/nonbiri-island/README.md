# のんびり島ぐらし（初期版・1島め）

ビルド不要の静的ブラウザゲーム。`index.html` / `style.css` / `game.js` の3ファイルだけで動きます。

## GitHub Pages で公開する手順

1. GitHub で新しいリポジトリを作る（例：`nonbiri-island`、Public）。
2. この3ファイル（＋README.md）をリポジトリ直下にアップロードする。
   - ブラウザから「Add file → Upload files」でドラッグ＆ドロップでOK。
3. リポジトリの **Settings → Pages** を開く。
4. 「Build and deployment」の Source を **Deploy from a branch** にし、Branch を **main / (root)** にして Save。
5. 1〜2分待つと `https://<ユーザー名>.github.io/nonbiri-island/` で遊べます。

iPhoneの Safari で開き「ホーム画面に追加」するとフルスクリーンのアプリ風に遊べます。

## 将来アプリ化するとき

全ファイルが相対パスの静的ファイルなので、そのまま Capacitor / Cordova / PWA（manifest + service worker を追加）でアプリ化できます。

## 調整したいとき

`game.js` の先頭にある `CONFIG`（各種秒数・上限・価格）、`ITEMS`（価格）、`BUILD`（施設の費用）、`GOALS`（チュートリアル目標と解放順）を書き換えるだけで、仕様書で未確定だった数値を変えられます。

セーブデータは localStorage の `nonbiri-island-v2` に保存されます。最初からやり直すには画面右上の ⚙️ を押してください。

## v0.2 の変更点（設計者フィードバック反映）
- 住居は棟数上限なし。市場は1×1になり、最初から建てられる（最初の目標）
- 幸福度 = 直近2分以内に市場から届いた商品の種類 ÷ 全商品の種類（%）。60%以上で人口増加
- 取り壊しは確認画面あり
- 最初の倉庫のスロットは「木材・石材・小麦・自動・自動」
- 道・広場・オフライン進行は廃止
- ⚙️ から「最初からやり直す」
