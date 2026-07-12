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
- `id`: `aosora:{ファイル stem（拡張子なし、番号プレフィックス込み）}` 形式
  （例: `04_04_変数.md` → `aosora:04_04_変数`）。stem をそのまま使うことで
  同名ページ追加時にも既存 ID が変わらない安定性を確保。読みやすさは `title` が担う
- `title`: ページ先頭の h1 見出し。無ければファイル名から番号プレフィックスと `_` 区切りを整形して使用
- `url`: `https://github.com/kanadelab/aosora-shiori/wiki/{encodeURIComponent(stem)}`
  で生成（ID とは独立した設計）。実 Wiki の URL と一致することを fixture ベースの
  テストで確認する（少なくとも日本語ページ 1 件を実 URL と突き合わせて検証済みにする）
- Markdown → プレーンテキスト化は**自前の軽量処理**（新規依存なし）。
  **先に fenced code（```` ``` ```` / `~~~`）と inline code（`` ` ``）の範囲を保護**し、
  その外側でのみ以下を適用する:
  - 見出し記号 `#` 除去（見出しテキストは保持）
  - リンク `[text](url)` → `text`、画像 `![alt](url)` → alt
  - Markdown 構文として成立する強調記号 `*` `_` の除去（コード内の演算子・`snake_case` は保護済み）
  - コードフェンス行自体は除去、コード内容は無加工で保持
  - テーブル罫線は行として保持（`|` 区切りのまま。検索に有用）
  - テスト対象: エスケープ、コードフェンス内の Markdown 風記号、`~~~` フェンス、
    inline code 内の `*` / `_`

### 3. 型・カテゴリ・検証

- `src/types.ts`: `Source` union に `'aosora_wiki'` を追加
- `src/constants.ts` の `CATEGORIES` に 4 カテゴリを追加:

  | カテゴリ ID | 対象章（ファイル番号プレフィックス） | 内容 |
  |---|---|---|
  | `aosora_grammar` | 03〜06 | スクリプトの書き方・関数ブロック・トークブロック・データ型 |
  | `aosora_builtin` | 07, 13 | 組み込み機能群・std ユニット |
  | `aosora_advanced` | 12 | ユニット・クラス・例外機構 |
  | `aosora_general` | 01, 02, 08〜11, 14〜16 | はじめに・SHIORI イベント・プロジェクト設定・VSCode 拡張ほか |

- カテゴリはファイル名の**第 1 階層番号**（正規表現 `/^(\d{2})_/` の捕捉値）から機械的に割当。
  例: `04_04_変数.md` → `04` → `aosora_grammar`、`13_02_JsonSerializer.md` → `13` → `aosora_builtin`。
  形式不一致・未知の番号は `aosora_general` に落とし、ビルド時に警告ログを出す
  （Wiki の構成変更の検知手段）
- **ソース列挙の一元化**: 現在 `Source` の値リストが
  `src/index-validation.ts` の `SOURCE_VALUES`（起動時 Zod 検証）と
  `src/tools/search-docs.ts` の `SOURCE_VALUES`（MCP 入力 schema）に重複手書きされている。
  `src/constants.ts` に単一の `SOURCE_VALUES` 定数を定義して両者から参照する形に統合し、
  そこへ `'aosora_wiki'` を追加する。`search-docs.ts` のツール説明文（3 ソース前提の文言）も更新
- `src/index-builder.ts` の `REQUIRED_SOURCES` に `'aosora_wiki'` を追加
- `src/build-index.ts`（収集処理の実体）に aosora パーサーの import・
  `docs/aosora-wiki/manual` のディレクトリ解決・収集フェーズを追加
  （`index-builder.ts` は統合後の検証・書き込みのみで、パーサー呼び出しはここではない）
- `INDEX_SCHEMA_VERSION` は **1 のまま据え置き**。フィールド構造は不変で、
  source/category の値追加のみ。`REQUIRED_SOURCES` は**生成時のみ**の検証であり、
  起動時検証は必須ソースの存在を確認しないため、aosora を欠く旧 index.json も
  ランタイムでは読み込み可能（後方互換として意図的に許容）。
  本変更のマージには index.json の再生成を同一 PR に含める

### 4. CI / リリース

- `.github/workflows/refresh-index-pr.yml`:
  - 差分検知パス（`git diff -- data/index.json docs/ukadoc`）に `docs/aosora-wiki` を追加
  - `add-paths`（PR にコミットされる対象パス）に `docs/aosora-wiki` を追加 —
    これが無いと submodule pointer 更新が PR に含まれない
  - PR 本文・スコープ記載（`docs/ukadoc` submodule pointer 等）に `docs/aosora-wiki` を追加
- `.github/workflows/ci.yml`: auto-index-refresh ラベル PR のスコープ検証許可リスト
  （現在 `'docs/ukadoc'` を含む）に `'docs/aosora-wiki'` を追加
- checkout は既に `submodules: recursive` のため追加作業なし
- **ネットワーク依存の増加は許容**: `refresh:index` への aosora submodule 更新追加により
  週次ジョブの外部依存が 1 つ増えるが、既に YAYA/里々 Wiki の HTTP スクレイプで
  ネットワーク依存しており、同等のリスクとして許容する（一時的な取得失敗は翌週の cron で回復）
- リリースは通常の patch/minor フロー。ソース追加は機能追加なので **minor bump** を推奨

### 5. テスト

- `tests/fixtures/aosora/` に実 Wiki から縮小した Markdown サンプルを配置
  （h1 あり/なし、コードブロック、テーブル、リンク、inline code 内記号を網羅する 2〜3 ファイル）
- パーサー単体テスト: タイトル抽出、URL 復元（実 Wiki URL との一致を含む）、
  カテゴリ割当（各章の代表 + 未知番号 + 形式不一致）、
  Markdown プレーンテキスト化（コード保護含む）、目次ページ除外
- 統合経路のテスト:
  - `aosora_wiki` を含む index が起動時 Zod 検証を通ること
  - `search_docs` の source schema が `aosora_wiki` を受理すること
  - 4 ソースのいずれかが欠けると build が失敗すること
- `REQUIRED_SOURCES` 変更に伴う index-builder / index-validation 既存テストの追随
  （共通 fixture の 4 ソース化を含む）

### 6. ドキュメント・公開情報の追随

- `src/types.ts` の canonical ID コメントに `aosora_wiki` 形式を追記
- `src/tools/get-doc.ts` の ID 例に aosora の例を追加
- `package.json` の `description` / `keywords`、`README.md`、`SPEC.md`、
  必要に応じて `NOTICE.md` を 4 ソース対応の記載に更新

## 対象外（YAGNI）

- 英語版ドキュメント（`manual_en-us/`）の取り込み
- ガイド・チュートリアルページ（`プログラミングガイド.md` 等）の取り込み
- Markdown パーサーライブラリの導入（remark 等）— 必要になったら再検討
- セクション（h2/h3）単位のエントリ分割
