# aosora-shiori Wiki ソース追加 設計

日付: 2026-07-12
ステータス: 承認済み

## 目的

蒼空（aosora-shiori）の GitHub Wiki リファレンスドキュメントを ukagaka-doc-mcp の
第 4 のドキュメントソースとして追加し、`search_docs` / `get_doc` / `list_categories`
から検索・参照できるようにする。

## 背景

GitHub Wiki は `https://github.com/kanadelab/aosora-shiori.wiki.git` という
git リポジトリであり、1 ページ = 1 Markdown ファイル。HTML スクレイピングは不要で、
UKADOC と同じ「ローカルファイルをパースする」方式が採れる。

対象は日本語リファレンス `manual/` 配下の Markdown のみ（承認済みの決定）。
英語版 `manual_en-us/`、ルートのガイド・チュートリアル類は対象外。

## 決定事項

### 1. ソース取得: git submodule

- `docs/aosora-wiki/` に `https://github.com/kanadelab/aosora-shiori.wiki.git` を submodule 追加
- `package.json` の `refresh:index` スクリプトに `docs/aosora-wiki` の
  `git submodule update --init --remote` を追加（現在は `docs/ukadoc` のみ明示指定）

### 2. パーサー: `src/parser/aosora-parser.ts`（新規）

- `docs/aosora-wiki/manual/*.md` を読み込む。ネットワークアクセスなし・レート制限不要
- **1 ページ = 1 エントリ**（YAYA 関数ページと同じ断片化防止方針。全 42 ページ合計 約104KB と小ぶり）
- 目次ページ `00_蒼空_リファレンスドキュメント.md` は除外（リンク集のため検索ノイズ）
- `id`: `aosora:{番号プレフィックスを除いたファイル名（拡張子なし）}` 形式
  （例: `aosora:変数`、`04_04_変数.md` から生成）。ファイル名衝突があれば番号込みにフォールバック
- `title`: ページ先頭の h1 見出し。無ければファイル名から番号プレフィックスと `_` 区切りを整形して使用
- `url`: ファイル名（拡張子除去）から GitHub Wiki URL を復元
  例: `04_04_変数.md` → `https://github.com/kanadelab/aosora-shiori/wiki/04_04_変数`
  （日本語はそのまま。GitHub 側でパーセントエンコードされた URL と等価に解決される）
- Markdown → プレーンテキスト化は**自前の軽量処理**（新規依存なし）:
  - 見出し記号 `#` 除去（見出しテキストは保持）
  - リンク `[text](url)` → `text`、画像 `![alt](url)` → alt
  - 強調記号 `*` `_` `` ` `` の除去（コードブロックの中身は保持）
  - コードフェンス ```` ``` ```` の行自体は除去、コード内容は保持
  - テーブル罫線は行として保持（`|` 区切りのまま。検索に有用）

### 3. 型・カテゴリ・検証

- `src/types.ts`: `Source` union に `'aosora_wiki'` を追加
- `src/constants.ts` の `CATEGORIES` に 4 カテゴリを追加:

  | カテゴリ ID | 対象章（ファイル番号プレフィックス） | 内容 |
  |---|---|---|
  | `aosora_grammar` | 03〜06 | スクリプトの書き方・関数ブロック・トークブロック・データ型 |
  | `aosora_builtin` | 07, 13 | 組み込み機能群・std ユニット |
  | `aosora_advanced` | 12 | ユニット・クラス・例外機構 |
  | `aosora_general` | 01, 02, 08〜11, 14〜16 | はじめに・SHIORI イベント・プロジェクト設定・VSCode 拡張ほか |

- カテゴリはファイル名の番号プレフィックスから機械的に割当。未知の番号は `aosora_general` に落とす
- `src/index-builder.ts` の `REQUIRED_SOURCES` に `'aosora_wiki'` を追加
- `src/index-builder.ts`（または build:index エントリ）で aosora パーサーを呼び出しに追加
- `INDEX_SCHEMA_VERSION` は **1 のまま据え置き**。フィールド構造は不変で、
  source/category の値追加のみ。ただし `REQUIRED_SOURCES` 追加により
  旧 index.json はビルド検証を通らなくなるため、本変更のマージには
  index.json の再生成を同一 PR に含める

### 4. CI / リリース

- `.github/workflows/refresh-index-pr.yml`:
  - 差分検知パス（`git diff -- data/index.json docs/ukadoc`）に `docs/aosora-wiki` を追加
  - PR 本文・スコープ記載（`docs/ukadoc` submodule pointer 等）に `docs/aosora-wiki` を追加
- `.github/workflows/ci.yml`: auto-index-refresh ラベル PR のスコープ検証許可リスト
  （現在 `'docs/ukadoc'` を含む）に `'docs/aosora-wiki'` を追加
- checkout は既に `submodules: recursive` のため追加作業なし
- リリースは通常の patch/minor フロー。ソース追加は機能追加なので **minor bump** を推奨

### 5. テスト

- `tests/fixtures/aosora/` に実 Wiki から縮小した Markdown サンプルを配置
  （h1 あり/なし、コードブロック、テーブル、リンクを網羅する 2〜3 ファイル）
- パーサー単体テスト: タイトル抽出、URL 復元、カテゴリ割当（各章の代表 + 未知番号）、
  Markdown プレーンテキスト化、目次ページ除外
- `REQUIRED_SOURCES` 変更に伴う index-builder / index-validation 既存テストの追随

## 対象外（YAGNI）

- 英語版ドキュメント（`manual_en-us/`）の取り込み
- ガイド・チュートリアルページ（`プログラミングガイド.md` 等）の取り込み
- Markdown パーサーライブラリの導入（remark 等）— 必要になったら再検討
- セクション（h2/h3）単位のエントリ分割
