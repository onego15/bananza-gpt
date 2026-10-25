# GitHub Pages 公開記録

- リポジトリ: https://github.com/onego15/bananza-gpt
- プレイURL: https://onego15.github.io/bananza-gpt/
- 公開作業開始: 2026-10-26 08:43:07 JST（時刻ツールで確認）
- 状態: 設定準備・検証中。公開完了と公開先での動作確認は、以下に実測後追記します。

## 構成

Viteのbaseを `/bananza-gpt/` に固定。GitHub Actionsが単体テストと静的ビルドを実行し、`dist/` をPages artifactとして公開します。JS・CSS・ライセンス以外の実行時アセットは手続き生成です。サーバー処理・APIキー・外部CDNは不要です。

## 再設定・更新

1. Settings → Pages → Sourceを **GitHub Actions** に設定。
2. `main` にpush、またはActions → **Build and deploy game to Pages** → Run workflow。
3. build・deployジョブの成功後、プレイURLを開く。

GitHub側で権限不足が出る場合は、リポジトリ管理者がPages・Actionsを有効化してください。公開ジョブには `pages: write` と `id-token: write` が必要です。公開APIキーや長期トークンをファイルに埋め込む必要はありません。

## 参照した公式資料

- [Vite: Deploying a Static Site](https://vite.dev/guide/static-deploy.html)
- [GitHub: Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
