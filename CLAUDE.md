# ukagaka-doc-mcp

伺か技術ドキュメント（UKADOC / YAYA Wiki / 里々Wiki）を検索する MCP サーバー。
ランタイムでは外部通信せず `data/index.json` のみを使用する。

## Commands

```bash
npm install          # 依存関係インストール
npm run build        # TypeScript → dist/
npm test             # vitest run
npm run dev          # tsx で直接起動（開発用）
npm start            # dist/index.js を起動
npm run refresh:index  # サブモジュール更新 + index.json 再生成
```

## Architecture

```
src/
  index.ts            # エントリポイント（stdio MCP サーバー起動）
  server.ts           # MCP サーバー定義
  bootstrap.ts        # index.json 読み込み → SearchEngine 初期化
  search/engine.ts    # 全文検索エンジン
  tools/              # MCP ツール（search_docs, get_doc, list_categories）
  parser/             # ビルド時のみ使用（HTML → index.json 生成）
    ukadoc-parser.ts  # UKADOC HTML パーサー
    yaya-scraper.ts   # YAYA Wiki スクレイパー
    satori-scraper.ts # 里々Wiki スクレイパー
  index-builder.ts    # 3パーサーを束ねてindex.json生成
  index-validation.ts # index.json スキーマ検証
data/
  index.json          # ドキュメントスナップショット（npm tarball に含む）
docs/
  ukadoc/             # git submodule（UKADOC HTML ソース）
```

## CI/CD

週次自動更新パイプライン（3ワークフロー連携）：

1. `refresh-index-pr.yml` — 毎週月曜 cron / 手動実行。docs 更新 → patch version bump → PR 作成（auto-merge）
2. `ci.yml` — PR / push で検証。auto-index-refresh ラベル付き PR はスコープ検証あり
3. `release.yml` — main push 時にコミットメッセージで判定 → npm publish → git tag → GitHub Release。`workflow_dispatch` で手動リリースも可能

認証は全て自動更新方式（静的トークンは期限切れで壊れるため不採用）：
- PR 作成: GitHub App トークン（`APP_ID` / `APP_PRIVATE_KEY` secrets）
- npm publish: OIDC Trusted Publishing（npmjs.com で Trusted Publisher 設定済み）

### Gotchas

- **npm publish は OIDC Trusted Publishing**。静的トークン不要だが npm CLI 11.5.1+ が必須（Node.js 20 同梱の npm 10.x では動かない）。ワークフロー内で `npm install -g "npm@>=11.5.1"` している
- **`setup-node` に `registry-url` を渡さないこと**。渡すと `GITHUB_TOKEN` が `NODE_AUTH_TOKEN` に自動注入され OIDC 認証が阻害される
- **`release.yml` のトリガーは `push`**。`pull_request_target` は OIDC subject claim が npm に拒否される
- PR 作成に GitHub App トークンを使用（`APP_ID` / `APP_PRIVATE_KEY` secrets）。`GITHUB_TOKEN` で作った PR は CI をトリガーしない
- **人手の dep PR は refresh-index PR と必ず衝突する**。週次 cron で `package.json` version と `package-lock.json` が頻繁に動くため、長く寝かせると merge 不能に。dep PR は branch を切ったら短期で merge まで進めるか、merge 直前に `git rebase origin/main` で吸収する。lockfile 衝突は `git checkout --ours package-lock.json && npm install --package-lock-only` で main 側を採用 → 自分の `package.json` 制約で再生成、が定石

## Testing

```bash
npm test              # 全テスト実行
npm run test:watch    # ウォッチモード
```

テストは vitest。`tests/fixtures/` にテスト用 HTML を配置。

## Code Style

- TypeScript strict mode、ESM（`"type": "module"`）
- `NodeNext` module resolution

## Maintenance

人手介入が必要な手順（dep 更新・`npm audit fix`・手動リリース・refresh-index 衝突対処等）は `docs/maintenance.md` に集約。トラブル時はまずそちらを参照。
