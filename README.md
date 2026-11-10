# 数学・理科シミュレーター（SAPIA）

値を動かすと、図・グラフ・式がいっしょに変わる教材集。公開先：https://sapia.pages.dev/simulator/

- 一覧：`index.html`（教科・学校段階・単元・キーワードでしぼりこみ）
- 教材：`sim.html?s=<id>`（1つのページで全教材を開く。`core/load.js` が `lib/<id>.js` と `sims/<id>.js` を読む）
- 公開：main に入ると `.github/workflows/studia.yml` が study の公開（Cloudflare Pages）を呼ぶ（Secret `STUDIA_TOKEN` が必要）。共通部品（nav.js・ui.js・mobile.js・sw.js・theme.css・celebrate.js・footer.js・errlog.js）は公開のときに study/common/ から自動で入る。検索エンジンに出さない設定（noindex・X-Robots-Tag）も公開のときに入る。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `catalog.js` | 教材の一覧（id・教科・単元・学年・説明・所要時間・キーワード・公開/準備中） |
| `app.js` | 一覧ページ |
| `sim.html` | 教材ページの枠（STEP 1 知る → 2 動かす → 3 なぜ？ → 4 確認問題） |
| `core/sim.js` | 共通の作り：操作パネル（スライダー＋数の入力・プリセット・表示の切りかえ・初期状態にもどす）、再生・一時停止・速さ・全画面・拡大縮小、確認問題、URL で設定を共有、続きから |
| `core/plot.js` | Canvas のグラフ部品（座標・目もり・軸ラベル・関数・点・矢印・文字の重なりよけ・拡大縮小）。色は今の見た目（11種）から取る |
| `core/load.js` | `?s=<id>` の教材を読みこむ |
| `lib/<id>.js` | 教材の計算だけ（画面なし）。Node でテストできる |
| `sims/<id>.js` | 教材の画面・説明・確認問題 |
| `test/<id>.test.js` | 計算のテスト |
| `tools/serve.sh` | 手元で共通部品を入れて開く（`bash tools/serve.sh` → http://localhost:8765/simulator/） |
| `tools/shot.js` | 画面写真を撮る（Playwright） |

## 教材の足し方

1. `catalog.js` に1件足す（`status: 'open'`、計算を分けるなら `lib: true`）
2. `lib/<id>.js`（計算）と `test/<id>.test.js` を書く
3. `sims/<id>.js` に `SimApp.register({ id, intro, assumptions, params, choices, toggles, presets, init, draw, formula, readouts, explain, quiz, ... })` を書く（書き方は `core/sim.js` の先頭と `sims/functions.js`）
4. `core/load.js` の `V` を上げる（スマホに残っている古い版を入れかえるため）。HTML の `?v=` も直したファイルの分を上げる
5. テスト：`node --test test/*.test.js`、画面：`bash tools/serve.sh` で スマホ縦（390×844）・PC（1366×820）・夜／黒板の見た目を確認

ホームの検索（study/deploy/build_search.js）は `catalog.js` の公開中の教材を自動で拾う。

## 決まりごと

- 数学・理科として正しいことが最優先。式と図を同じ計算から出す。単位・軸・目もり・符号を必ず出す。理想化・簡略化・縮尺の誇張は「このモデルの約束」に書く。
- 物理の再生は、表示の時間＝計算の時間（位置は毎コマ解析解で出す）。遅くして見せるときは再生速度を出す。
- 色だけで区別しない（線の種類・点の形・文字も変える）。動きを減らす設定（studyStill）では自動で動かさない。
- 画面の文はタメ口。「塾」という言葉は使わない。外部ライブラリ・外部通信なし（CSP で eval も使えない）。
