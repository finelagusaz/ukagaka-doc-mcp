# 伺か技術ドキュメント検索 MCPサーバー仕様

## 1. 目的

このリポジトリは、伺か（Ukagaka）の技術ドキュメントをビルド時に収集・正規化し、MCPサーバー経由で検索・参照可能にする。

本仕様は、実装計画ではなく、外部契約と不変条件を定義する。

## 2. 用語

- **MUST**: 必須要件
- **SHOULD**: 強く推奨される要件
- **MAY**: 任意要件
- **インデックス**: `data/index.json`
- **canonical_id**: 各ドキュメントエントリを一意に識別するID

## 3. スコープ

### 3.1 対象ソース

本サーバーは以下の3ソースのみを対象とする。

1. UKADOC (`docs/ukadoc/manual/`)
2. YAYA Wiki (`https://emily.shillest.net/ayaya/`)
3. 里々Wiki (`https://soliton.sub.jp/satori/`)

### 3.2 非スコープ

以下は本仕様の対象外とする。

- ランタイムでの外部サイト再取得
- 差分同期やRSS更新
- 書き込み系MCPツール
- 歴史的参考資料の横断検索

## 4. アーキテクチャ

### 4.1 ビルド時

`npm run build:index` は以下を行う。

1. UKADOC をローカルHTMLからパースする
2. YAYA Wiki をHTTP取得してパースする
3. 里々Wiki をHTTP取得してパースする
4. 3ソースを統合して `data/index.json` を生成する

### 4.2 ランタイム

ランタイムは以下を満たさなければならない。

- 起動時ネットワーク通信ゼロであること
- `data/index.json` の読み込みだけで起動できること
- `generatedAt` が 7 日を超えて古い場合、警告を出すことが望ましい
- `data/index.json` が存在しない場合、起動失敗すること

## 5. データモデル

### 5.1 Source

```ts
type Source = 'ukadoc' | 'yaya_wiki' | 'satori_wiki';
```

### 5.2 Category

カテゴリは単一ソースの定数定義を正とし、少なくとも以下を含む。

```ts
type Category =
  | 'sakurascript'
  | 'shiori_event'
  | 'descript'
  | 'protocol'
  | 'file_structure'
  | 'dev_guide'
  | 'yaya_grammar'
  | 'yaya_basic'
  | 'yaya_function'
  | 'yaya_system'
  | 'yaya_tips'
  | 'yaya_startup'
  | 'satori_reference'
  | 'satori_event'
  | 'satori_tips'
  | 'satori_saori';
```

### 5.3 DocEntry

`DocEntry` はインデックスに保存される基本単位であり、以下を満たさなければならない。

```ts
type DocEntry = {
  id: string;
  title: string;
  source: Source;
  category: Category;
  content: string;
  url: string;
};
```

#### 要件

- `id` は全エントリで一意でなければならない
- `title` は空文字であってはならない
- `content` は全文でなければならない
- `content` は保存時に要約化してはならない
- `url` はそのエントリの元ページまたは元セクションを指さなければならない

### 5.4 SearchEntry

`SearchEntry` は `search_docs` の返却用派生型である。

```ts
type SearchEntry = {
  id: string;
  title: string;
  source: Source;
  category: Category;
  summary: string;
  url: string;
};
```

#### 要件

- `summary` は `content` から導出される表示用テキストであること
- `summary` は `content` の先頭 500 文字であること
- `content` が 500 文字を超える場合に限り、`summary` の末尾に明示的な省略記号 `...` を付与すること
- 省略時の `summary` は `content.slice(0, 500) + "..."` と等価でなければならない
- `summary` 生成時に改行や空白の追加正規化を行ってはならない
- `summary` はインデックスの正規データではなく派生値であること

### 5.5 IndexFile

```ts
type IndexFile = {
  version: number;
  generatedAt: string;
  entries: DocEntry[];
};
```

#### 要件

- `generatedAt` は ISO 8601 文字列でなければならない
- `entries` に重複 `id` が存在してはならない
- `entries` に無効ページやエラーページが含まれてはならない

## 6. canonical_id

### 6.1 共通原則

- `canonical_id` は安定かつ一意でなければならない
- 同じ文書断片は、ビルドのたびに同じ `id` を持つべきである
- 別の文書断片が同じ `id` を持ってはならない
- `id` の重複が発生した場合、ビルドは失敗しなければならない

### 6.2 ソース別ルール

#### UKADOC

- 形式は `ukadoc:{filename}:{anchor}` を基本とする
- `anchor` には、ソースHTMLに存在する `id` または `name` を優先的に使用しなければならない
- 優先順位は `id` → `name` → フォールバックでなければならない
- フォールバック形式は `ukadoc:{filename}:{normalized_raw_title}:{occurrence_index}` とする
- `occurrence_index` は、同一ページ内で同じ `normalized_raw_title` が出現した順の 1 始まり整数とする
- `normalized_raw_title` は安定した正規化文字列でなければならない
- フォールバックは、記号除去や小文字化だけに依存してはならない

#### YAYA Wiki

- 関数ページは `yaya:{page_path}` とする
- セクション分割ページは `yaya:{page_path}#{anchor}` とする
- `page_path` はURLデコード済みの論理ページパスとする

#### 里々Wiki

- ページ単位は `satori:{page_name}` とする
- セクション分割ページは `satori:{page_name}#{anchor}` とする
- `page_name` はURLデコード済みの論理ページ名とする

## 7. 収集・正規化仕様

### 7.1 リンク正規化

Wikiリンクは取得前に正規化しなければならない。

#### 必須ルール

- `./?foo` は `?foo` に正規化する
- `#fragment` はページ取得対象から除去する
- ページ内アンカーは別ページとしてクロールしてはならない
- 外部リンクはクロール対象に含めてはならない
- `cmd=` または `plugin=` を含むメタ操作リンクは除外しなければならない

### 7.2 エラーページ除外

以下のようなページはインデックスに含めてはならない。

- `有効なWikiNameではありません`
- ログイン要求ページ
- 差分、履歴、凍結、編集、添付などのメタページ
- 実コンテンツではなくナビゲーションのみのページ

### 7.3 テキスト抽出

- ナビゲーション、フッター、編集UIは本文抽出前に除去すること
- セクション単位で分割するページでは、見出しと本文の対応が保たれなければならない
- 関数ページのように1ページ1エントリと定義された対象は、セクション分割してはならない

## 8. 検索仕様

### 8.1 `search_docs`

#### 入力

- `query: string` MUST
- `category?: Category`
- `source?: Source`
- `limit?: number`

#### 動作

- 大文字小文字を無視する
- 日本語・英語とも部分一致を許可する
- バックスラッシュは `\\s` → `\s` のように正規化して比較する
- スコアリング優先度は以下とする
  1. タイトル完全一致
  2. タイトル部分一致
  3. 本文部分一致

#### 出力

- ヒット時は `status: "ok"` を返す
- ヒット0件時は `status: "not_found"` を返す
- `data` は `SearchEntry[]` とする
- `summary` は本仕様 5.4 の規則に従って `content` から導出する
- デフォルト件数は 10、最大件数は 50 とする

### 8.2 `get_doc`

#### 入力

- `id: string` MUST

#### 動作

- 指定された `id` に一致する `DocEntry` を1件だけ返す
- 一致が0件なら `not_found`
- 一致が2件以上存在する状態は仕様違反であり、インデックス生成時点で防止されていなければならない

#### 出力

- `content` は全文でなければならない
- `summary` は返さない

### 8.3 `list_categories`

- カテゴリ一覧を返す
- 各カテゴリは `id`, `source`, `label` を持つ
- 実装はカテゴリ定数を単一ソースとして利用しなければならない

## 9. ビルド仕様

### 9.1 成功条件

`npm run build:index` は、以下をすべて満たしたときのみ成功してよい。

- 必須3ソースの取得・パースが完了している
- 重複 `id` が存在しない
- 無効ページが含まれていない
- 各ソースが空でない
- 各ソースについて少なくとも1カテゴリ以上のエントリが存在する

### 9.2 失敗条件

以下のいずれかに該当した場合、ビルドは失敗しなければならない。

- ソース取得失敗
- パース失敗
- 重複 `id`
- 無効ページ混入
- 各ソースについて少なくとも1カテゴリ以上のエントリが存在しない

### 9.3 出力の原子性

- ビルド中は既存 `data/index.json` を直接上書きしてはならない
- 一時ファイルに出力し、検証成功後にのみ置き換えなければならない
- 失敗時は前回の正常な `data/index.json` を保持しなければならない

### 9.4 部分成功の禁止

- UKADOC だけ成功、YAYA/里々失敗のような部分成功を正規成果物として出力してはならない
- ビルドは fail-open ではなく fail-closed でなければならない

## 10. ランタイム仕様

### 10.1 起動

- サーバー起動時は `data/index.json` を読み込む
- 読み込みに成功したらインメモリ検索エンジンへロードする
- 読み込み失敗時はプロセスを正常起動してはならない

### 10.2 freshness 警告

- `generatedAt` が 7 日より古い場合、警告を出すことが望ましい
- 警告は起動失敗条件ではない

### 10.3 不正インデックスの扱い

ランタイムは `data/index.json` の不正を検出した場合、種類に応じて以下のように扱わなければならない。

#### 起動失敗とすべきもの

- JSON パース失敗
- 必須フィールド欠落
- `id` 重複
- `content` 空
- `entries` が空

#### 警告付き起動でよいもの

- `generatedAt` 不正
- `version` 不一致
- 未知カテゴリの混入

### 10.4 ランタイムでの外部通信

- ランタイムは外部HTTPアクセスを行ってはならない
- 検索・全文取得・カテゴリ列挙は、すべてローカルインデックスだけで完結しなければならない

## 11. 受け入れ条件

少なくとも以下を自動テストで担保すること。

- `DocEntry.content` が全文保存されること
- `search_docs` が 500 文字要約を返すこと
- `search_docs` の省略時 `summary` が `content.slice(0, 500) + "..."` と一致すること
- `get_doc` が全文を返すこと
- 重複 `id` がビルド失敗になること
- `#fragment` 付きWikiリンクが別ページとしてクロールされないこと
- エラーページがインデックスに入らないこと
- バックスラッシュ正規化検索が正しく動作すること
- `data/index.json` 不在時に起動失敗すること
- `generatedAt` の stale 判定が動作すること
- `id` 重複を含む不正インデックスで起動失敗すること
- `version` 不一致を含むインデックスで警告付き起動すること
- ビルド失敗時に既存 `data/index.json` が保持されること

## 12. 実装計画との関係

- `implementation_plan.md` は実装順序と作業計画を扱う
- `SPEC.md` は不変条件と外部契約を扱う
- 実装と計画が衝突した場合、外部契約に関しては本仕様を優先する
