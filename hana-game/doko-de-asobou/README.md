# どこで遊ぼうゲーム — 移植用コード

ブラウザゲームのソース一式です（HTML + JavaScript + 画像）。外部ライブラリは使っていません（フォントに Google Fonts の Zen Maru Gothic を読み込んでいます。なくても動きます）。

## ファイル構成
- `index.html` … 画面の枠（ヘッダー、キャンバス、もちもの欄、UFOキャッチャーの重ね画面）とCSS
- `app.js` … ゲーム本体（約990行・1ファイル）
- `assets/` … すべての画像（透過WebP）。コードからは `assets/ファイル名.webp` で参照

## 動かし方
`index.html` をそのまま開いても動きますが、ブラウザによっては地図の「陸地判定」が使えません（その場合はどこでも歩ける動作に自動で切り替わります）。確実に動かすには簡易サーバーで開いてください。
```
python3 -m http.server 8000   # → http://localhost:8000
```

## 全体の仕組み
- **キャンバス1枚（1536×1024）** に、場面ごとに描画を切り替えています。
  - `scene` 変数が現在の場面: `map`（地図）/ `picnic` / `park` `slide` `swing` `sand`（公園）/ `room` `sink` `bed`（自宅）/ `shop`（スーパー）/ `game`（UFOキャッチャー）。
  - 場面の切り替え（白フェード）は `trans`、切り替えの中身は `applyScene(to)`（公園・自宅・スーパー系は `parkEnter(to)`）。
  - 主なループは `loop()`。`park` 系の場面は `parkFrame()` が描画と更新をまとめて行います。
- **UFOキャッチャー** だけは別の重ねキャンバス（`#claw` / `#cc`、1024×1536）で、`openClaw()` で開き、`clLoop()` で動きます。
- 座標系: 各場面の絵は画像ピクセルの座標で配置しています（`pc(ix,iy)` が画像→画面、`pinv(x,y)` が逆変換）。スーパーは横スクロール（`SHOP.cam`）。
- 入力: ポインタ（マウス／タッチ）のみ。`cv.addEventListener('pointerdown', …)` から場面ごとの `parkDown` などに振り分けています。UFOキャッチャーは矢印キーとスペースも使えます。
- 保存: `localStorage` に `dkd_placed`（ピクニックの置いたもの）、`dkd_room`（部屋のもの）、`dkd_shop`（店の商品の配置）。

## 場面ごとの主な関数（app.js 内で検索してください）
| 場面 | 主な関数・変数 |
|---|---|
| 地図 | `MSPOTS`（場所のあたり判定 `hx,hy,r`）、`go()`、`arrive()`、`startIdea()` |
| ピクニック | `PSPOTS`、`SHEET`（敷物の範囲）、`inBasket()`、`ITEMS`（もちもの）、ドラッグは `grabItem()` と `pointerup` |
| 公園 | `PARKSPOTS`、`parkTapPark()`、すべり台 `SL`/`slideRide()`、ブランコ `SW`/`swingUpdate()`、すなば `BK`/`bkFill()`/`bkPour()`/`SHOVEL` |
| 自宅の部屋 | `ROOM`、`ROOMSPOTS`、`roomSpawn()`（出す）、`roomUp()`（しまう）、玄関マットから外へ出る処理は `roomDown()` |
| 洗面台 | `SINK`、`sinkPump()`、`sinkFaucet()`。タオル／歯ブラシは `TOWEL_ON` / `BRUSH_ON`（今は false） |
| ベッド | `BED`、`NIGHT`、`WAKE`（おやすみ → 暗転 → おはよう） |
| スーパー | `SHOP`、`SH_U`/`SH_ROW`（棚の位置）、`REG`（レジ）、`shopLCD()`（液晶に 100×個数） |
| UFOキャッチャー | `MACH`、`VEH`/`FOODS`（景品）、`clUpdate()`、`drawPlay()`、`drawSelect()` |

## 画像の差し替え
- 画像は `assets/` の同名ファイルを置き換えるだけで差し替わります（縦横比を変えると位置合わせが必要な場面があります）。
- 景品のサイズは `VEH` / `FOODS` の `ph`、もちもの欄は `ITEMS` の `size`、あたり判定は各場面の座標定数です。
- ブランコ（`scene_swL/swR/swing`）は、くさりと座面を背景から切り離した画像で動かしています。
- 洗面台の歯ブラシ・タオル用の画像（`scene_brushB/brushP/towel`）は、切り抜き画像ができたら `BRUSH_ON` / `TOWEL_ON` を true にして使います（背景を「歯ブラシなし」に差し替える必要があります）。

## 画像一覧
`scene_*`（背景・家具）、`poko_*`（ポコ各ポーズ）、`item_*`（食べ物）、`vehicle_*`（乗り物）、`claw_*`（UFOキャッチャー本体・アーム・スティック）、`shovel`（スコップ）。
