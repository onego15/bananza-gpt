# 依存ライブラリと素材

| 名前 | バージョン | 用途 | ライセンス |
| --- | --- | --- | --- |
| Three.js | 0.180.0 | WebGL描画、数学、ポストプロセス、形状生成 | MIT |
| Vite | 6.1.0 | 開発サーバー・ビルド | MIT |
| Playwright / @playwright/test | 1.51.1 | 独立したChromeでのQA | Apache-2.0 |

Three.js の著作権表示・ライセンス全文は [three.txt](../public/licenses/three.txt) に同梱しています。製品ビルドにも `licenses/three.txt` がコピーされます。開発用依存関係の完全なバージョンは `package-lock.json`、ライセンス本文はインストール後の各パッケージの `LICENSE` を参照してください。

キャラクター、敵、岩肌、植物、鉱石、建築、UI、効果音、環境音楽は、このプロジェクト内のコードから生成します。外部の3Dモデル、画像、音楽、キャラクター素材は使用していません。原作の固有キャラクター・地形・楽曲のデータは含みません。

公式技術資料：[Three.js ポストプロセス](https://threejs.org/manual/pages/post-processing.html)、[EffectComposer](https://threejs.org/docs/pages/EffectComposer.html)。
