# ukagaka-doc-mcp

伺か（Ukagaka）の技術ドキュメントを検索できる MCP サーバーです。

UKADOC・SSP ヘルプ・YAYA docs・里々 docs・蒼空 Wiki・湊 docs・Pasta docs・華和梨 docs のスナップショットを同梱しているため、stdio モード（デフォルト）では**実行中に外部ネットワークへアクセスしません**。

## 使い方

### npx で実行する（インストール不要）

```bash
npx ukagaka-doc-mcp
```

### グローバルインストールして実行する

```bash
npm install -g ukagaka-doc-mcp
ukagaka-doc-mcp
```

## Claude Desktop での設定

`~/Library/Application Support/Claude/claude_desktop_config.json` に次の設定を追加してください。

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

**グローバルインストールした場合：**

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

`--http` を付けて起動すると、Streamable HTTP で通信する MCP サーバーになります（ステートレス・認証なし）。

```bash
npx ukagaka-doc-mcp --http                              # http://127.0.0.1:8951/mcp
npx ukagaka-doc-mcp --http --host 0.0.0.0 --port 9000   # 待ち受けるアドレスとポートを変更
```

| オプション | 説明 | デフォルト |
|------------|------|------------|
| `--http` | HTTP モードで起動する | なし（stdio モード） |
| `--host <host>` | 待ち受けるホスト | `127.0.0.1` |
| `--port <port>` | 待ち受けるポート | `8951` |

- エンドポイントは `POST /mcp` だけです。
- MCP 仕様 2026-07-28（リクエストごとに `_meta` エンベロープを付ける方式）のクライアントと、それより前の `initialize` ハンドシェイク方式（2025-11-25 / 2025-06-18 / 2025-03-26 / 2024-11-05）のクライアントを、同じエンドポイントで受け付けます。2025 系以前のリクエストには、これまでどおり `application/json` で応答します。stdio モードもどちらの方式にも対応しています。
- `Host` / `Origin` ヘッダーは検証しません。外部に公開する場合は、nginx などのリバースプロキシの背後に置いてください。
- 起動直後と、その後 24 時間ごとに [GitHub 上の最新の `data/index.json`](https://github.com/finelagusaz/ukagaka-doc-mcp/raw/refs/heads/main/data/index.json) を取得し、同梱版より新しければメモリ上のインデックスを差し替えます（ファイルには書き込みません）。取得に失敗した場合は、現在のインデックスのまま動作を続けます。

## 提供するツール

| ツール | 説明 |
|--------|------|
| `list_categories` | 検索対象のカテゴリ一覧を返す |
| `search_docs` | キーワードでドキュメントを検索する |
| `get_doc` | URL を指定してドキュメント本文を取得する |

## 検索対象

| ソース | 内容 |
|--------|------|
| UKADOC | 伺か全般の仕様・リファレンス |
| SSP ヘルプ（[ukadoc-ssp](https://ukatech.shillest.net/ukadoc-ssp/)） | SSP 本体の使い方・機能・設定 |
| YAYA docs（[yaya-docs](https://github.com/YAYA-shiori/yaya-docs)） | YAYA スクリプトのリファレンス |
| 里々 docs（[satori-docs](https://github.com/ukatech/satori-docs)） | 里々スクリプト・ssu のリファレンス |
| 蒼空(aosora) Wiki | 蒼空 shiori/GHOST 開発ガイド |
| 湊 docs（[minato](https://mizuki-yura.github.io/minato/)） | 湊（Minato）SHIORI のリファレンス、里々・YAYA からの移行ガイド |
| Pasta docs（[pasta](https://ekicyou.github.io/pasta/)） | Pasta SHIORI の Pasta DSL 文法・Lua API・デバッグ・内部設計 |
| 華和梨 docs（[kawari-docs](https://ukatech.shillest.net/kawari-docs/)） | 華和梨（KAWARI）SHIORI の辞書文法・KIS コマンド・SHIORI/SAORI インターフェース・移行ガイド・仕様書 |

これらは `data/index.json` としてパッケージに同梱しており、CI が週に 1 回自動で更新します。

## 動作環境

- Node.js 22 以上

## 開発

```bash
npm install
npm run refresh:index   # ドキュメントを取得してインデックスを生成
npm run build
npm start
```

テストの実行：

```bash
npm test
```

メンテナンス（依存パッケージの更新・脆弱性への対応・手動リリースなど）の手順は [docs/maintenance.md](docs/maintenance.md) にまとめています。

## インデックスの自動更新の流れ

```
毎週月曜（cron）または手動で実行
  ↓ docs/ 配下の各サブモジュールを最新にする
  ↓ data/index.json を再生成する
  ↓ 変更があればパッチバージョンを上げて PR を自動作成する
  ↓ CI が通ったら auto-merge する
  ↓ npm への公開・git tag・GitHub Release の作成を自動で行う
```

### 必要な設定

| 項目 | 内容 |
|------|------|
| `APP_ID` secret | GitHub App の ID |
| `APP_PRIVATE_KEY` secret | GitHub App の秘密鍵 |
| リポジトリの auto-merge | Settings → General → Allow auto-merge を有効にする |
| npm Trusted Publishers | npmjs.com のパッケージ設定でこのリポジトリを登録する |

## パッケージの内容

npm tarball には次のファイルが含まれます。

- `dist/` — コンパイル済みの JS
- `data/index.json` — ドキュメントのスナップショット
- `LICENSE` / `NOTICE.md` / `README.md` / `SPEC.md`

`src/`・`tests/`・`docs/`（ドキュメントのサブモジュール）は含まれません。

## ライセンス

ソースコードは **MIT License** で提供しています（`LICENSE` を参照）。

同梱の `data/index.json` は、UKADOC・SSP ヘルプ・YAYA docs・里々 docs・蒼空 Wiki・湊 docs・Pasta docs・華和梨 docs をもとに生成した外部由来のデータであり、MIT License の対象ではありません。利用・再配布の際は、上流の権利関係を各自でご確認ください（`NOTICE.md` を参照）。
