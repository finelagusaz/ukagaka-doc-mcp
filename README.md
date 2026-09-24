# ukagaka-doc-mcp

伺か（Ukagaka）の技術ドキュメントを検索する MCP サーバーです。

UKADOC・YAYA Wiki・里々Wiki・蒼空 Wiki のスナップショットを同梱しており、stdio モード（デフォルト）では**ランタイムで外部ネットワークにアクセスしません**。

## 使い方

### npx（インストール不要）

```bash
npx ukagaka-doc-mcp
```

### グローバルインストール

```bash
npm install -g ukagaka-doc-mcp
ukagaka-doc-mcp
```

## Claude Desktop への組み込み

`~/Library/Application Support/Claude/claude_desktop_config.json` に追加します。

**npx を使う場合（推奨）：**

```json
{
  "mcpServers": {
    "ukagaka-doc": {
      "command": "npx",
      "args": ["ukagaka-doc-mcp"]
    }
  }
}
```

**グローバルインストール済みの場合：**

```json
{
  "mcpServers": {
    "ukagaka-doc": {
      "command": "ukagaka-doc-mcp"
    }
  }
}
```

## HTTP モード

`--http` を付けると Streamable HTTP の MCP サーバーとして起動します（ステートレス・認証なし）。

```bash
npx ukagaka-doc-mcp --http                              # http://127.0.0.1:8951/mcp
npx ukagaka-doc-mcp --http --host 0.0.0.0 --port 9000   # listen 先を変更
```

| オプション | 説明 | デフォルト |
|------------|------|------------|
| `--http` | HTTP モードで起動 | （なし＝stdio） |
| `--host <host>` | listen するホスト | `127.0.0.1` |
| `--port <port>` | listen するポート | `8951` |

- エンドポイントは `POST /mcp` のみです。
- MCP 仕様 2026-07-28（リクエスト単位の `_meta` エンベロープ）と、それ以前の `initialize` ハンドシェイク方式（2025-11-25 / 2025-06-18 / 2025-03-26 / 2024-11-05）の両方のクライアントを同じエンドポイントで受け付けます。2025 系以前のリクエストへの応答は従来どおり `application/json` です。stdio モードも同様に両方に対応します。
- `Host` / `Origin` ヘッダの検証は行いません。外部に公開する場合は nginx 等のリバースプロキシの背後に置いてください。
- 起動直後と 24 時間ごとに [GitHub 上の最新 `data/index.json`](https://github.com/finelagusaz/ukagaka-doc-mcp/raw/refs/heads/main/data/index.json) を取得し、同梱版より新しければメモリ上で差し替えます（ファイルには書き込みません）。取得に失敗した場合は現在のインデックスのまま動作を続けます。

## 提供ツール

| ツール | 説明 |
|--------|------|
| `list_categories` | 検索対象のカテゴリ一覧を返す |
| `search_docs` | キーワードでドキュメントを検索する |
| `get_doc` | URL を指定してドキュメント本文を取得する |

## 検索対象

| ソース | 内容 |
|--------|------|
| UKADOC | 伺か全般の仕様・リファレンス |
| YAYA Wiki | YAYA スクリプトのリファレンス |
| 里々Wiki | 里々スクリプトのリファレンス |
| 蒼空(aosora) Wiki | 蒼空 shiori/GHOST 開発ガイド |

`data/index.json` として同梱済みです。週1回 CI が自動更新します。

## 必要環境

- Node.js 20 以上

## 開発

```bash
npm install
npm run refresh:index   # ドキュメントの取得とインデックス生成
npm run build
npm start
```

テスト：

```bash
npm test
```

メンテナンス（依存更新・脆弱性対応・手動リリース等）の手順は [docs/maintenance.md](docs/maintenance.md) を参照してください。

## インデックスの自動更新フロー

```
毎週月曜（cron）または手動実行
  ↓ docs/ukadoc サブモジュールを最新化
  ↓ data/index.json を再生成
  ↓ 変更があればパッチバージョンを上げて PR を自動作成
  ↓ CI 通過後に auto-merge
  ↓ npm publish・git tag・GitHub Release を自動作成
```

### 必要な設定

| 項目 | 内容 |
|------|------|
| `APP_ID` secret | GitHub App の ID |
| `APP_PRIVATE_KEY` secret | GitHub App の秘密鍵 |
| リポジトリの auto-merge | Settings → General → Allow auto-merge を有効化 |
| npm Trusted Publishers | npmjs.com のパッケージ設定でこのリポジトリを登録 |

## パッケージ内容

npm tarball に含まれるファイル：

- `dist/` — コンパイル済み JS
- `data/index.json` — ドキュメントスナップショット
- `LICENSE` / `NOTICE.md` / `README.md` / `SPEC.md`

`src/`・`tests/`・`docs/ukadoc/` は含みません。

## ライセンス

実装コードは **MIT License**（`LICENSE` 参照）。

同梱の `data/index.json` は UKADOC・YAYA Wiki・里々Wiki・蒼空 Wiki を元に生成した外部由来データです。MIT License での再ライセンスは行っていません。利用・再配布時は上流の権利関係を別途確認してください（`NOTICE.md` 参照）。
