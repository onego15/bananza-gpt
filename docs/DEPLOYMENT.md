# GitHub Pages 公開記録

- リポジトリ: https://github.com/onego15/bananza-gpt
- プレイURL: https://onego15.github.io/bananza-gpt/
- 公開作業開始: 2026-10-26 08:43:07 JST（時刻ツールで確認）
- 状態: **GitHub Pages公開済み**。公開URLの通常起動・描画・操作・掘削・保存、およびエンディングまでの進行検証に成功。
- 初回公開: 2026-10-26 08:56:12 JST（GitHub Actionsの完了時刻）。
- 公開ゲームのソース: `f138c29ca77a5462232bc0472263ca16361aab1e`。
- [初回デプロイ成功](https://github.com/onego15/bananza-gpt/actions/runs/40246891427) / [実行記録](qa-github-actions.json)。CIでも単体テスト8件とビルドが成功しました。

## 公開先での実測

専用の空Chromeプロファイル、1280×800、通常URL（QAモードなし）で検証しました。2026-10-26 08:56:33〜08:57:48 JST。

| 検証 | 結果 |
| --- | --- |
| 公開HTML・JS・CSS | HTTP 200。すべて `/bananza-gpt/` 配下で取得成功。 |
| 実描画 | WebGLでタイトルとゲームを描画。スクリーンショットを目視確認。 |
| 入力 | WASD移動、Spaceジャンプ、E床掘りを実入力で確認。 |
| UI | Tabの地図、Hのガイド、Rの帰還が動作。 |
| セーブ | 掘削後に帰還・保存し、再読み込み後も掘削履歴を保持。 |
| 実行エラー・失敗リクエスト | いずれも0件。 |
| 公開ファイル照合 | HTML・JS・CSS・Three.jsライセンスがローカル本番ビルドとバイト単位で一致。 |

[通常URLの検証ログ](qa-public-deployment.json) / [ファイル照合・SHA256](qa-public-assets.json) / [公開タイトル](public-title.png) / [公開ゲーム画面](public-play.png)。

## 公開先の通しプレイ

**PASS**。公開URLを新しい空Chromeプロファイルで開き、通常のキーボード操作で移動・ジャンプ・パンチ・溜め攻撃を行い、壁を掘って三エリアを探索。灯種3/3、鳴石2/2、守護者撃破、祭壇でFを押してエンディングまで到達しました。

`?qa` で状態を観測していますが、進行中のテレポートや進行フラグの変更は行っていません。ゲーム内経過49.35秒、掘削履歴42件。座標を知る自動操作なので、人間の初見所要時間の根拠にはなりません。

再読み込み後も三つの灯種・鳴石・守護者・エンディング・42件の地形編集を保持。JavaScript実行エラー0件。

[公開先の進行生ログ](qa-public-playthrough.json) / [公開先のエンディング画像](public-ending.png)。

## 公開先の初回負荷試験と追加調整

初回公開版では、床・天井・空中叩きつけ・斜め方向への掘削と通過が成功しました。一方、250件のCSG編集後の測定は平均 **24.55fps**、p95フレーム間隔 **69.20ms** で、テストの `>25fps` 基準を下回り、試験はそこで失敗しました。成功と扱っていません。

[初回の失敗を含む生ログ](qa-public-stress-first.json) / [そのときのゲーム画面](public-stress-first.png)。

この結果を受け、動作更新を止めていた遠方の敵について描画も省くよう調整。また、性能基準を下回っても保存・帰還などの機能検証を最後まで行い、機能の成否と性能未達を区別して記録するよう試験を改善しました。性能基準そのものは下げていません。

確認は `tests/deployment.mjs` で再実行できます。PowerShellの場合:

```powershell
$env:TEST_URL='https://onego15.github.io/bananza-gpt/'
node tests/deployment.mjs
node tests/playthrough.mjs
node tests/stress.mjs
```

実行環境のChromeの場所が異なる場合は `CHROME_PATH` を設定してください。通常起動テストにQAコマンドはありません。進行・負荷テストでは `?qa` を付けて観測・境界条件のセットアップを行います。

## 構成

Viteのbaseを `/bananza-gpt/` に固定。GitHub Actionsが単体テストと静的ビルドを実行し、`dist/` をPages artifactとして公開します。JS・CSS・ライセンス以外の実行時アセットは手続き生成です。サーバー処理・APIキー・外部CDNは不要です。

## 再設定・更新

1. Settings → Pages → Sourceを **GitHub Actions** に設定。
2. 実行用ファイルを変更して `main` にpush、またはActions → **Build and deploy game to Pages** → Run workflow。README・docsだけの更新は再デプロイを省きます。
3. build・deployジョブの成功後、プレイURLを開く。

GitHub側で権限不足が出る場合は、リポジトリ管理者がPages・Actionsを有効化してください。公開ジョブには `pages: write` と `id-token: write` が必要です。公開APIキーや長期トークンをファイルに埋め込む必要はありません。

## 参照した公式資料

- [Vite: Deploying a Static Site](https://vite.dev/guide/static-deploy.html)
- [GitHub: Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
