# ukagaka-doc-mcp

伺か（Ukagaka）の技術ドキュメントを検索する MCP サーバーです。

UKADOC・YAYA Wiki・里々Wiki のスナップショットを同梱しており、**ランタイムで外部ネットワークにアクセスしません**。

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

同梱の `data/index.json` は UKADOC・YAYA Wiki・里々Wiki を元に生成した外部由来データです。MIT License での再ライセンスは行っていません。利用・再配布時は上流の権利関係を別途確認してください（`NOTICE.md` 参照）。
