# aosora-shiori Wiki ソース追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 蒼空（aosora-shiori）GitHub Wiki の日本語リファレンス（`manual/*.md`）を第 4 のドキュメントソースとして index に取り込み、MCP ツールから検索可能にする。

**Architecture:** Wiki の裏 git リポジトリ（`aosora-shiori.wiki.git`）を `docs/aosora-wiki/` に submodule 追加し、ビルド時にローカル Markdown をパース（1 ページ = 1 エントリ、ネットワーク不要）。ソース列挙は `constants.ts` の `SOURCE_VALUES` に一元化する。

**Tech Stack:** TypeScript (strict, ESM, NodeNext), vitest, zod。**新規依存なし**（Markdown 処理は自前実装）。

**Spec:** `docs/superpowers/specs/2026-07-12-aosora-wiki-source-design.md`

## Global Constraints

- TypeScript strict mode / ESM (`"type": "module"`) / NodeNext module resolution
- import は必ず `.js` 拡張子付き（例: `from './constants.js'`）
- 新規 npm 依存を追加しない
- テストは vitest（`npm test` = `vitest run`）
- ID 形式: `aosora:{ファイル stem（拡張子なし、番号プレフィックス込み）}` — 例 `aosora:04_04_変数`
- URL 形式: `https://github.com/kanadelab/aosora-shiori/wiki/{encodeURIComponent(stem)}`
- 目次ページ（`00_` プレフィックス）は除外
- コミットメッセージ末尾: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 作業ブランチ: `feat/aosora-wiki-source`（作成済み）

---

### Task 1: SOURCE_VALUES 一元化と aosora 型・カテゴリ追加

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/types.ts:8`
- Modify: `src/index-validation.ts:1-5`
- Modify: `src/tools/search-docs.ts:5-19`
- Test: `tests/index-validation.test.ts`

**Interfaces:**
- Consumes: なし（最初のタスク）
- Produces:
  - `constants.ts` から `export const SOURCE_VALUES = ['ukadoc', 'yaya_wiki', 'satori_wiki', 'aosora_wiki'] as const`
  - `types.ts` の `Source` 型が `'aosora_wiki'` を含む（`(typeof SOURCE_VALUES)[number]` 由来）
  - `CATEGORIES` に `aosora_grammar` / `aosora_builtin` / `aosora_advanced` / `aosora_general` キー（後続タスクが `Category` 値として使用）

- [ ] **Step 1: 失敗するテストを書く**

`tests/index-validation.test.ts` に追加（既存の describe ブロック内、`validateIndexFile` が既に import 済みであることを確認して利用）:

```typescript
it('aosora_wiki ソースのエントリを受理する', () => {
  const { indexFile } = validateIndexFile({
    version: 1,
    generatedAt: '2026-07-12T00:00:00.000Z',
    entries: [
      {
        id: 'aosora:04_04_変数',
        title: '変数',
        source: 'aosora_wiki',
        category: 'aosora_grammar',
        content: 'ローカル変数とグローバル変数',
        url: 'https://github.com/kanadelab/aosora-shiori/wiki/04_04_%E5%A4%89%E6%95%B0',
      },
    ],
  });
  expect(indexFile.entries).toHaveLength(1);
  expect(indexFile.entries[0].source).toBe('aosora_wiki');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/index-validation.test.ts`
Expected: FAIL（`source` の zod enum が `aosora_wiki` を拒否、または `aosora_grammar` が unknown category として drop され "Index has no valid entries"）

- [ ] **Step 3: constants.ts に SOURCE_VALUES と aosora カテゴリを追加**

`src/constants.ts` — `import type { Source } from './types.js';` の直後（`STALE_AFTER_DAYS` の前）に追加:

```typescript
/** 全ソース種別（単一ソース。types.ts の Source 型と各所の zod enum がここから派生） */
export const SOURCE_VALUES = ['ukadoc', 'yaya_wiki', 'satori_wiki', 'aosora_wiki'] as const;
```

`CATEGORIES` の末尾（`satori_saori` エントリの後）に追加:

```typescript
  // --- 蒼空 (aosora) Wiki ---
  aosora_grammar: {
    source: 'aosora_wiki' as Source,
    label: '蒼空スクリプト文法（関数・トーク・データ型）',
  },
  aosora_builtin: {
    source: 'aosora_wiki' as Source,
    label: '蒼空組み込み機能・stdユニット',
  },
  aosora_advanced: {
    source: 'aosora_wiki' as Source,
    label: '蒼空発展的トピック（ユニット・クラス・例外）',
  },
  aosora_general: {
    source: 'aosora_wiki' as Source,
    label: '蒼空全般（導入・SHIORIイベント・プロジェクト設定 等）',
  },
```

- [ ] **Step 4: types.ts の Source 型を SOURCE_VALUES から派生させる**

`src/types.ts` の先頭 import と `Source` 定義を変更:

```typescript
import type { CATEGORIES, SOURCE_VALUES } from './constants.js';

// ソース種別（constants.ts の SOURCE_VALUES から派生）
export type Source = (typeof SOURCE_VALUES)[number];
```

注: `import type` なのでランタイム循環参照は発生しない（constants.ts 側の `import type { Source }` も同様に消去される）。

同ファイルの `DocEntry.id` の JSDoc コメントに 1 行追加:

```typescript
   * - aosora_wiki: `aosora:{ファイルstem}` (例: aosora:04_04_変数)
```

- [ ] **Step 5: index-validation.ts と search-docs.ts のローカル SOURCE_VALUES を削除して constants から import**

`src/index-validation.ts`:

```typescript
import { CATEGORIES, INDEX_SCHEMA_VERSION, SOURCE_VALUES } from './constants.js';
```

とし、ローカルの `const SOURCE_VALUES = [...] as const;`（5行目）を削除。

`src/tools/search-docs.ts`:

```typescript
import { CATEGORIES, SOURCE_VALUES } from '../constants.js';
```

とし、ローカルの `const SOURCE_VALUES = [...] as const;`（7行目）を削除。さらにツール説明文 2 箇所を更新:

```typescript
    '伺か・YAYA・里々・蒼空の技術ドキュメントをキーワード検索する。要約（500文字）を返す。詳細は get_doc で取得。',
```

```typescript
      source: z.enum(SOURCE_VALUES).optional()
        .describe('ソースで絞り込み: ukadoc / yaya_wiki / satori_wiki / aosora_wiki'),
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run tests/index-validation.test.ts && npm run build`
Expected: PASS（全テスト）+ tsc エラーなし

- [ ] **Step 7: Commit**

```bash
git add src/constants.ts src/types.ts src/index-validation.ts src/tools/search-docs.ts tests/index-validation.test.ts
git commit -m "feat: unify SOURCE_VALUES and add aosora_wiki source/categories

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Markdown プレーンテキスト化ユーティリティ

**Files:**
- Create: `src/parser/aosora-parser.ts`（このタスクでは `markdownToPlainText` のみ）
- Test: `tests/parser/aosora-parser.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `export function markdownToPlainText(markdown: string): string`

- [ ] **Step 1: 失敗するテストを書く**

`tests/parser/aosora-parser.test.ts` を新規作成:

```typescript
import { describe, expect, it } from 'vitest';
import { markdownToPlainText } from '../../src/parser/aosora-parser.js';

describe('markdownToPlainText', () => {
  it('見出し記号を除去しテキストを保持する', () => {
    expect(markdownToPlainText('# タイトル\n\n## 節')).toBe('タイトル\n\n節');
  });

  it('リンクと画像をテキストに変換する', () => {
    expect(markdownToPlainText('[変数](04_04_変数)を参照。![図](img.png)'))
      .toBe('変数を参照。図');
  });

  it('強調記号を除去する', () => {
    expect(markdownToPlainText('**重要** と *注意* と _補足_')).toBe('重要 と 注意 と 補足');
  });

  it('コードフェンス内は無加工で保持しフェンス行を除去する', () => {
    const md = '説明\n```\ntalk = "**not emphasis**";\n# not heading\n```\n後続';
    expect(markdownToPlainText(md)).toBe('説明\ntalk = "**not emphasis**";\n# not heading\n後続');
  });

  it('~~~ フェンスも扱える', () => {
    const md = '~~~\nx * y\n~~~';
    expect(markdownToPlainText(md)).toBe('x * y');
  });

  it('inline code 内の記号を保護する', () => {
    expect(markdownToPlainText('`a * b` と `snake_case` は保持')).toBe('a * b と snake_case は保持');
  });

  it('テーブル行を | 区切りのまま保持する', () => {
    const md = '| 型 | 説明 |\n|---|---|\n| number | 数値 |';
    expect(markdownToPlainText(md)).toBe('| 型 | 説明 |\n|---|---|\n| number | 数値 |');
  });

  it('3行以上の連続空行を圧縮し前後の空白を除去する', () => {
    expect(markdownToPlainText('\n\na\n\n\n\nb\n\n')).toBe('a\n\nb');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/parser/aosora-parser.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: 実装を書く**

`src/parser/aosora-parser.ts` を新規作成:

```typescript
/**
 * 蒼空 (aosora-shiori) GitHub Wiki パーサー
 *
 * docs/aosora-wiki/manual/*.md（git submodule）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。
 *
 * 設計方針:
 * - 1ページ = 1エントリ（情報断片化防止。全42ページ・計約100KBと小ぶり）
 * - 目次ページ（00_ プレフィックス）は除外
 * - Markdown → プレーンテキスト化はコード範囲を保護してから記号を除去
 */

/**
 * Markdown をプレーンテキストに変換する。
 * fenced code / inline code の中身は無加工で保持する。
 */
export function markdownToPlainText(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let fenceMarker: '```' | '~~~' | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      const marker = fenceMatch[1] as '```' | '~~~';
      if (fenceMarker === null) {
        fenceMarker = marker; // フェンス開始行は出力しない
      } else if (fenceMarker === marker) {
        fenceMarker = null; // フェンス終了行も出力しない
      } else {
        out.push(line); // フェンス内の別種マーカーはコードとして保持
      }
      continue;
    }

    if (fenceMarker !== null) {
      out.push(line); // コードフェンス内は無加工
      continue;
    }

    out.push(stripInlineMarkdown(line));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 1行分の inline Markdown 記法を除去する。inline code の中身は保護する。 */
function stripInlineMarkdown(line: string): string {
  // inline code を NUL 区切りプレースホルダに退避
  const codeSpans: string[] = [];
  let text = line.replace(/`([^`]*)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  text = text
    .replace(/^#{1,6}\s+/, '')                    // 見出し記号
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')     // 画像 → alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // リンク → テキスト
    .replace(/(\*\*|__)(.+?)\1/g, '$2')           // 強い強調
    .replace(/(\*|_)([^\s*_][^*_]*)\1/g, '$2');   // 強調

  // 退避した inline code を復元
  return text.replace(/\u0000(\d+)\u0000/g, (_match, i: string) => codeSpans[Number(i)]);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/parser/aosora-parser.test.ts`
Expected: PASS（8 テスト）

- [ ] **Step 5: Commit**

```bash
git add src/parser/aosora-parser.ts tests/parser/aosora-parser.test.ts
git commit -m "feat: add markdown-to-plaintext converter for aosora parser

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: aosora パーサー本体（fixture ベース）

**Files:**
- Modify: `src/parser/aosora-parser.ts`（Task 2 で作成済み）
- Create: `tests/fixtures/aosora/00_蒼空_リファレンスドキュメント.md`
- Create: `tests/fixtures/aosora/04_04_変数.md`
- Create: `tests/fixtures/aosora/06_データ型.md`
- Create: `tests/fixtures/aosora/13_02_JsonSerializer.md`
- Create: `tests/fixtures/aosora/99_未知の章.md`
- Test: `tests/parser/aosora-parser.test.ts`（追記）

**Interfaces:**
- Consumes: `markdownToPlainText`（Task 2）、`Category` / `DocEntry` 型と `aosora_*` カテゴリ（Task 1）
- Produces: `export function parseAosoraWiki(manualDir: string): DocEntry[]`

- [ ] **Step 1: fixture を作成**

`tests/fixtures/aosora/00_蒼空_リファレンスドキュメント.md`（目次 = 除外対象）:

```markdown
# 蒼空 リファレンスドキュメント

- [はじめに](01_はじめに)
- [変数](04_04_変数)
```

`tests/fixtures/aosora/04_04_変数.md`（h1 あり・コード・inline code・リンク）:

````markdown
# 変数

蒼空の変数には**ローカル変数**とグローバル変数があります。

```
local x = 1;
x = x * 2;
```

`snake_case` の識別子も使えます。詳細は[データ型](06_データ型)を参照。
````

`tests/fixtures/aosora/06_データ型.md`（h1 なし・テーブル → タイトルはファイル名由来）:

```markdown
蒼空のデータ型の一覧です。

| 型 | 説明 |
|---|---|
| number | 数値 |
| string | 文字列 |
```

`tests/fixtures/aosora/13_02_JsonSerializer.md`（builtin 章・第2階層番号あり）:

```markdown
# JsonSerializer

JSONのシリアライズ機能を提供します。
```

`tests/fixtures/aosora/99_未知の章.md`（未知番号 → general フォールバック）:

```markdown
# 未知の章

将来追加された章のテスト。
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/parser/aosora-parser.test.ts` に追記:

```typescript
import { resolve } from 'node:path';
import { parseAosoraWiki } from '../../src/parser/aosora-parser.js';

const fixtureDir = resolve('tests/fixtures/aosora');

describe('parseAosoraWiki', () => {
  const entries = parseAosoraWiki(fixtureDir);
  const byId = new Map(entries.map(e => [e.id, e]));

  it('目次ページ（00_）を除外する', () => {
    expect(entries.some(e => e.id.startsWith('aosora:00_'))).toBe(false);
    expect(entries).toHaveLength(4);
  });

  it('id はファイル stem 込みの安定形式', () => {
    expect(byId.has('aosora:04_04_変数')).toBe(true);
  });

  it('title は先頭 h1 見出しから取得する', () => {
    expect(byId.get('aosora:04_04_変数')?.title).toBe('変数');
  });

  it('h1 が無い場合はファイル名から番号を除いて整形する', () => {
    expect(byId.get('aosora:06_データ型')?.title).toBe('データ型');
  });

  it('url は encodeURIComponent した GitHub Wiki URL', () => {
    expect(byId.get('aosora:04_04_変数')?.url).toBe(
      'https://github.com/kanadelab/aosora-shiori/wiki/04_04_%E5%A4%89%E6%95%B0',
    );
  });

  it('第1階層番号でカテゴリ割当する', () => {
    expect(byId.get('aosora:04_04_変数')?.category).toBe('aosora_grammar');
    expect(byId.get('aosora:06_データ型')?.category).toBe('aosora_grammar');
    expect(byId.get('aosora:13_02_JsonSerializer')?.category).toBe('aosora_builtin');
  });

  it('未知番号は aosora_general に落ちる', () => {
    expect(byId.get('aosora:99_未知の章')?.category).toBe('aosora_general');
  });

  it('content は Markdown 記号が除去されコード内容は保持される', () => {
    const content = byId.get('aosora:04_04_変数')?.content ?? '';
    expect(content).toContain('ローカル変数');
    expect(content).not.toContain('**');
    expect(content).toContain('x = x * 2;');
    expect(content).toContain('snake_case');
  });

  it('source は aosora_wiki', () => {
    expect(entries.every(e => e.source === 'aosora_wiki')).toBe(true);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run tests/parser/aosora-parser.test.ts`
Expected: FAIL（`parseAosoraWiki` が未エクスポート）

- [ ] **Step 4: 実装を書く**

`src/parser/aosora-parser.ts` の先頭に import を追加し、末尾に実装を追加:

```typescript
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Category, DocEntry } from '../types.js';
```

```typescript
const AOSORA_WIKI_BASE_URL = 'https://github.com/kanadelab/aosora-shiori/wiki/';

/**
 * manual ディレクトリ内の Markdown を全てパースして DocEntry 配列を返す。
 * 目次ページ（00_ プレフィックス）と空ページは除外する。
 */
export function parseAosoraWiki(manualDir: string): DocEntry[] {
  const files = readdirSync(manualDir)
    .filter(file => file.endsWith('.md'))
    .sort();

  const entries: DocEntry[] = [];

  for (const file of files) {
    const stem = file.replace(/\.md$/, '');
    if (/^00_/.test(stem)) continue; // 目次ページは検索ノイズのため除外

    const raw = readFileSync(join(manualDir, file), 'utf-8');
    const content = markdownToPlainText(raw);
    if (!content) continue;

    entries.push({
      id: `aosora:${stem}`,
      title: extractTitle(raw, stem),
      source: 'aosora_wiki',
      category: categoryForStem(stem),
      content,
      url: `${AOSORA_WIKI_BASE_URL}${encodeURIComponent(stem)}`,
    });
  }

  return entries;
}

/** 先頭 h1 見出し。無ければファイル名から番号プレフィックスを除いて整形。 */
function extractTitle(markdown: string, stem: string): string {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return stem.replace(/^\d{2}(_\d{2})?_/, '').replace(/_/g, ' ');
}

/**
 * ファイル名の第1階層番号（/^(\d{2})_/）からカテゴリを割当する。
 * - 03〜06: aosora_grammar（スクリプト・関数・トーク・データ型）
 * - 07, 13: aosora_builtin（組み込み機能・stdユニット）
 * - 12: aosora_advanced（ユニット・クラス・例外）
 * - その他既知（01,02,08〜11,14〜16）: aosora_general
 * - 形式不一致・未知番号: 警告を出して aosora_general（Wiki構成変更の検知手段）
 */
function categoryForStem(stem: string): Category {
  const match = stem.match(/^(\d{2})_/);
  if (!match) {
    console.error(`[aosora-parser] Warning: unexpected filename format, falling back to aosora_general: ${stem}`);
    return 'aosora_general';
  }

  const chapter = Number(match[1]);
  if (chapter >= 3 && chapter <= 6) return 'aosora_grammar';
  if (chapter === 7 || chapter === 13) return 'aosora_builtin';
  if (chapter === 12) return 'aosora_advanced';
  if ((chapter >= 1 && chapter <= 2) || (chapter >= 8 && chapter <= 11) || (chapter >= 14 && chapter <= 16)) {
    return 'aosora_general';
  }

  console.error(`[aosora-parser] Warning: unknown chapter ${match[1]}, falling back to aosora_general: ${stem}`);
  return 'aosora_general';
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run tests/parser/aosora-parser.test.ts`
Expected: PASS（全テスト）

- [ ] **Step 6: 実 Wiki URL との一致を手動検証（1回のみ）**

Run: `curl -s -o /dev/null -w "%{http_code}" "https://github.com/kanadelab/aosora-shiori/wiki/04_04_%E5%A4%89%E6%95%B0"`
Expected: `200`（生成 URL が実ページに解決されることの確認。CI では実行しない）

- [ ] **Step 7: Commit**

```bash
git add src/parser/aosora-parser.ts tests/parser/aosora-parser.test.ts tests/fixtures/aosora
git commit -m "feat: add aosora wiki parser

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: REQUIRED_SOURCES に aosora_wiki を追加

**Files:**
- Modify: `src/index-builder.ts:7`
- Test: `tests/index-builder.test.ts`

**Interfaces:**
- Consumes: `Source` 型に `'aosora_wiki'`（Task 1）
- Produces: `buildIndexFile` が aosora_wiki エントリの存在を要求する

- [ ] **Step 1: 失敗するテストを書く**

`tests/index-builder.test.ts` の `validEntries` に 4 件目を追加:

```typescript
  {
    id: 'aosora:04_04_変数',
    title: '変数',
    source: 'aosora_wiki',
    category: 'aosora_grammar',
    content: 'd',
    url: 'https://example.com/d',
  },
```

describe ブロックにテストを追加:

```typescript
  it('aosora_wiki が欠けるとビルド失敗する', () => {
    expect(() => buildIndexFile(validEntries.slice(0, 3))).toThrow(/Missing entries for required source: aosora_wiki/);
  });
```

既存テストの追随: 「必須ソースが欠けるとビルド失敗する」の `validEntries.slice(0, 2)` は 4 件ベースでも satori_wiki 欠落のまま成立するため変更不要。他のテストが `validEntries` 全体を使っている場合、4 ソース化された配列でそのまま通ることを確認する。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/index-builder.test.ts`
Expected: 新テストが FAIL（`aosora_wiki` は必須ソースでないためエラーが投げられない）

- [ ] **Step 3: 実装**

`src/index-builder.ts:7` を変更:

```typescript
const REQUIRED_SOURCES: Source[] = ['ukadoc', 'yaya_wiki', 'satori_wiki', 'aosora_wiki'];
```

- [ ] **Step 4: 全テストが通ることを確認**

Run: `npm test`
Expected: PASS（bootstrap / search 等の共通 fixture が 3 ソース前提で失敗する場合は、その fixture にも上記と同形式の aosora エントリを 1 件追加して追随させる）

- [ ] **Step 5: Commit**

```bash
git add src/index-builder.ts tests/
git commit -m "feat: require aosora_wiki entries in index build

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: submodule 追加と build:index / refresh:index 統合

**Files:**
- Create: `docs/aosora-wiki`（git submodule）+ `.gitmodules` 更新
- Modify: `src/build-index.ts`
- Modify: `package.json:43`（`refresh:index` スクリプト）

**Interfaces:**
- Consumes: `parseAosoraWiki(manualDir)`（Task 3）
- Produces: `data/index.json` に aosora エントリが含まれる（Task 7 で再生成）

- [ ] **Step 1: submodule を追加**

```bash
git submodule add https://github.com/kanadelab/aosora-shiori.wiki.git docs/aosora-wiki
ls docs/aosora-wiki/manual | head -5
```

Expected: `00_蒼空_リファレンスドキュメント.md` 等が表示される

- [ ] **Step 2: build-index.ts に Phase 4 を追加**

`src/build-index.ts` — import に追加:

```typescript
import { parseAosoraWiki } from './parser/aosora-parser.js';
```

Phase 3（里々Wiki）ブロックの直後・「統合」の前に追加:

```typescript
  // --- Phase 4: 蒼空 Wiki ---
  console.error('[build-index] Parsing aosora wiki...');
  const aosoraManualDir = resolve(__dirname, '..', 'docs', 'aosora-wiki', 'manual');
  const aosoraEntries = parseAosoraWiki(aosoraManualDir);
  entries.push(...aosoraEntries);
  console.error(`[build-index] aosora wiki: ${aosoraEntries.length} entries`);
```

ファイル冒頭コメントの「全ソース（UKADOC, YAYA Wiki, 里々Wiki）」を「全ソース（UKADOC, YAYA Wiki, 里々Wiki, 蒼空Wiki）」に更新。

- [ ] **Step 3: refresh:index スクリプトを更新**

`package.json` の `refresh:index` を変更:

```json
"refresh:index": "git submodule sync --recursive && git submodule update --init --remote docs/ukadoc docs/aosora-wiki && npm run build:index",
```

- [ ] **Step 4: ビルドが通ることを確認**

Run: `npm run build`
Expected: tsc エラーなし

- [ ] **Step 5: Commit**

```bash
git add .gitmodules docs/aosora-wiki src/build-index.ts package.json
git commit -m "feat: integrate aosora wiki submodule into index build

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: CI ワークフローとドキュメントの追随

**Files:**
- Modify: `.github/workflows/refresh-index-pr.yml:39,63-77`
- Modify: `.github/workflows/ci.yml:52-57`
- Modify: `src/tools/get-doc.ts:10-12`
- Modify: `package.json:4-5`（description / keywords）
- Modify: `README.md`, `SPEC.md`（存在すれば。3 ソース前提の記述を 4 ソースに更新）
- Modify: `CLAUDE.md`（Architecture のパーサー一覧）

**Interfaces:**
- Consumes: なし（テキスト変更のみ）
- Produces: なし

- [ ] **Step 1: refresh-index-pr.yml を更新**

差分検知（39行目）:

```yaml
          if git diff --quiet --exit-code -- data/index.json docs/ukadoc docs/aosora-wiki; then
```

PR 本文（67行目付近）:

```yaml
            - `docs/ukadoc` / `docs/aosora-wiki` submodule pointers
```

`add-paths`（73行目〜）:

```yaml
          add-paths: |
            data/index.json
            docs/ukadoc
            docs/aosora-wiki
            package.json
            package-lock.json
```

- [ ] **Step 2: ci.yml のスコープ検証許可リストを更新**

```javascript
            const allowedFiles = new Set([
              'data/index.json',
              'docs/ukadoc',
              'docs/aosora-wiki',
              'package.json',
              'package-lock.json',
            ]);
```

- [ ] **Step 3: get-doc.ts の ID 例を更新**

```typescript
      id: z.string().describe(
        'canonical_id（例: "yaya:マニュアル/関数/REPLACE", "satori:特殊記号一覧", "ukadoc:list_sakura_script:tag_s", "aosora:04_04_変数"）',
      ),
```

- [ ] **Step 4: package.json / README.md / SPEC.md / CLAUDE.md を更新**

`package.json` description:

```json
"description": "MCP server for searching Ukagaka (伺か) technical documentation: UKADOC, YAYA Wiki, 里々Wiki, and 蒼空(aosora) Wiki",
```

keywords 配列に `"aosora"` を追加。

`README.md` / `SPEC.md` / `NOTICE.md`: 「3 ソース」「UKADOC / YAYA / 里々」を列挙している箇所を grep（`grep -rn "里々" README.md SPEC.md NOTICE.md`）し、蒼空 Wiki を加えて 4 ソースに更新。ソース一覧表があれば行を追加（URL: `https://github.com/kanadelab/aosora-shiori/wiki`）。

`CLAUDE.md` の Architecture セクションの parser 一覧に 1 行追加:

```
    aosora-parser.ts  # 蒼空Wiki（GitHub Wiki submodule）パーサー
```

同じく `docs/` の説明に `aosora-wiki/  # git submodule（蒼空 Wiki Markdown ソース）` を追加。

- [ ] **Step 5: テスト・ビルド確認と Commit**

Run: `npm test && npm run build`
Expected: PASS

```bash
git add .github/workflows/refresh-index-pr.yml .github/workflows/ci.yml src/tools/get-doc.ts package.json README.md SPEC.md CLAUDE.md
git commit -m "chore: update CI workflows and docs for aosora wiki source

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: index.json 再生成と統合検証

**Files:**
- Modify: `data/index.json`（再生成）

**Interfaces:**
- Consumes: 全タスクの成果物
- Produces: aosora エントリ入りの `data/index.json`（リリース対象）

- [ ] **Step 1: index を再生成**

Run: `npm run refresh:index`
Expected: `[build-index] aosora wiki: 41 entries` 前後（42 ファイル − 目次 1）が出力され、正常終了。
YAYA/里々のスクレイプでネットワークに数分かかるのは正常。

- [ ] **Step 2: 再生成された index を検証**

Run: `node -e "const i=require('./data/index.json'); const a=i.entries.filter(e=>e.source==='aosora_wiki'); console.log(a.length, a[0].id, a[0].url); console.log([...new Set(a.map(e=>e.category))]);"`
Expected: 41 前後 / `aosora:01_はじめに` / GitHub Wiki URL / カテゴリ 4 種（`aosora_grammar`, `aosora_builtin`, `aosora_advanced`, `aosora_general`）

- [ ] **Step 3: 全テスト + サーバー起動スモーク**

Run: `npm test && npm run build && echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"変数","source":"aosora_wiki"}}}' | timeout 10 node dist/index.js 2>/dev/null | head -c 500`

Expected: テスト全 PASS。スモークで `aosora:` の id を含む JSON が返る（MCP initialize handshake が必要で単発 JSON では応答しない場合は、`npm test` の bootstrap テスト通過をもって代替とする）。

- [ ] **Step 4: Commit**

```bash
git add data/index.json
git commit -m "chore: regenerate index.json with aosora wiki entries

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: PR 作成（minor bump）**

```bash
npm version minor --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump minor version for aosora wiki source

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push -u origin feat/aosora-wiki-source
gh pr create --title "feat: add aosora-shiori wiki as fourth documentation source" --body "$(cat <<'EOF'
蒼空（aosora-shiori）GitHub Wiki の日本語リファレンス（manual/ 42ページ）を第4のドキュメントソースとして追加。

- docs/aosora-wiki submodule（aosora-shiori.wiki.git）
- src/parser/aosora-parser.ts（ローカルMarkdownパース、ネットワーク不要）
- SOURCE_VALUES を constants.ts に一元化
- カテゴリ4種: aosora_grammar / aosora_builtin / aosora_advanced / aosora_general
- CI（refresh-index-pr / ci）の対象パス追加

Spec: docs/superpowers/specs/2026-07-12-aosora-wiki-source-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

注: 週次 refresh-index PR（`bot/refresh-index`）が open の場合は先にそちらを merge するか、本 PR を merge 直前に `git rebase origin/main` する（CLAUDE.md の Gotchas 参照）。
