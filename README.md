# ukagaka-doc-mcp

伺か（Ukagaka）の技術ドキュメントを検索する MCP サーバーです。

以下の3ソースをビルド時に収集したスナップショットを検索対象にします。

- UKADOC
- YAYA Wiki
- 里々Wiki

ランタイムでは外部ネットワークにアクセスせず、同梱された `data/index.json` を読み込んで動作します。

## 提供ツール

- `list_categories`
- `search_docs`
- `get_doc`

## 必要環境

- Node.js 20 以上

## インストール

```bash
npm install -g ukagaka-doc-mcp
```

## 使い方

標準入出力で MCP サーバーとして起動します。

```bash
ukagaka-doc-mcp
```

## Claude Desktop 設定例

```json
{
  "mcpServers": {
    "ukagaka-doc": {
      "command": "ukagaka-doc-mcp"
    }
  }
}
```

## 開発

依存関係を入れたあと、インデックスを生成してからサーバーを起動します。

```bash
npm install
npm run refresh:index
npm run build
npm start
```

テスト:

```bash
npm test
```

## インデックス更新

`data/index.json` は静的スナップショットです。ランタイムでは自動更新しません。

- ローカル手動更新: `npm run refresh:index`
- 自動更新 PR: `.github/workflows/refresh-index-pr.yml`
- CI: `.github/workflows/ci.yml`
- release: `.github/workflows/release.yml`

自動更新は以下の流れです。

1. `refresh-index-pr.yml` が毎週 1 回または手動実行で動く
2. `docs/ukadoc` submodule を最新化し、`data/index.json` を再生成する
3. 変更があれば patch version を 1 つ進めて自動 PR を作成する
4. `ci.yml` が PR を検証し、成功したら auto-merge で `main` に取り込む
5. `release.yml` が merge 後に npm publish、git tag、GitHub Release を行う

必要な GitHub / npm 側設定:

- `AUTOMATION_GITHUB_TOKEN` secret
  - fine-grained PAT 推奨
  - repository contents: write
  - pull requests: write
- repository setting の auto-merge 有効化
- npm Trusted Publishing でこの GitHub repository を publisher 登録

## パッケージ内容

npm パッケージには公開実行に必要なファイルだけを含めます。

- `dist/`
- `data/index.json`
- `LICENSE`
- `NOTICE.md`
- `README.md`
- `SPEC.md`

`docs/ukadoc/` や `src/`、`tests/` は npm tarball に含めません。

## ライセンス

このリポジトリの実装コードは MIT License です。詳細は `LICENSE` を参照してください。

ただし、同梱している `data/index.json` は UKADOC、YAYA Wiki、里々Wiki を元に生成した外部由来データです。この生成物は MIT License では再ライセンスしていません。利用・再配布時は上流の権利関係を別途確認してください。詳細は `NOTICE.md` を参照してください。
