/**
 * YAYA docs パーサー
 *
 * docs/yaya-docs/{dir}/*.md（git submodule: YAYA-shiori/yaya-docs）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。
 *
 * 設計方針:
 * - 1ページ = 1エントリ（情報断片化防止。最大ページでも約15KB）
 * - 目次ページ（INDEX.md・system/system-functions-index.md）は除外
 * - 対象ディレクトリは上流 .pages の nav と対応させる
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Category, DocEntry } from '../types.js';
import { markdownToPlainText } from './markdown.js';

const YAYA_DOCS_BASE_URL = 'https://yaya-shiori.github.io/yaya-docs/';
const YAYA_DOCS_RAW_BASE_URL = 'https://raw.githubusercontent.com/YAYA-shiori/yaya-docs/refs/heads/main/';

/** ディレクトリ → カテゴリ（上流 .pages の nav 順） */
const DIR_CATEGORIES: Record<string, Category> = {
  grammar: 'yaya_grammar',
  basic: 'yaya_basic',
  system: 'yaya_system',
  startup: 'yaya_startup',
  other: 'yaya_other',
  functions: 'yaya_function',
  tips: 'yaya_tips',
};

/** 目次ページは検索ノイズのため除外（リポジトリ直下の INDEX.md は走査対象外） */
const EXCLUDED_PAGES = new Set(['system/system-functions-index']);

/** ページ本文を持たないディレクトリ */
const NON_CONTENT_DIRS = new Set(['assets', 'scripts', 'overrides']);

/**
 * yaya-docs リポジトリ内の Markdown を全てパースして DocEntry 配列を返す。
 * 未知のディレクトリは警告を出してスキップする（上流の構成変更の検知手段）。
 */
export function parseYayaDocs(rootDir: string): DocEntry[] {
  if (!existsSync(rootDir)) {
    throw new Error(`YAYA docs directory not found: ${rootDir}\nRun: git submodule update --init --recursive`);
  }

  const dirs = readdirSync(rootDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.') && !NON_CONTENT_DIRS.has(dirent.name))
    .map(dirent => dirent.name)
    .sort();

  const entries: DocEntry[] = [];

  for (const dir of dirs) {
    // 継承プロパティ（constructor 等）に当たらないよう自身のキーだけを引く
    const category = Object.hasOwn(DIR_CATEGORIES, dir) ? DIR_CATEGORIES[dir] : undefined;
    if (!category) {
      console.error(`[yaya-docs-parser] Warning: unknown directory, skipped: ${dir}`);
      continue;
    }

    const files = readdirSync(join(rootDir, dir))
      .filter(file => file.endsWith('.md'))
      .sort();

    for (const file of files) {
      const pagePath = `${dir}/${file.replace(/\.md$/, '')}`;
      if (EXCLUDED_PAGES.has(pagePath)) continue;

      const encodedPath = pagePath.split('/').map(encodeURIComponent).join('/');
      const raw = readFileSync(join(rootDir, dir, file), 'utf-8');
      const content = markdownToPlainText(raw);
      if (!content) continue;

      entries.push({
        id: `yaya:${pagePath}`,
        title: extractTitle(raw, pagePath),
        source: 'yaya_docs',
        category,
        content,
        url: `${YAYA_DOCS_BASE_URL}${encodedPath}/`,
        rawUrl: `${YAYA_DOCS_RAW_BASE_URL}${encodedPath}.md`,
      });
    }
  }

  return entries;
}

/** 先頭 h1 見出し（上流サイトもページ名を H1 から決める）。無ければファイル名。 */
function extractTitle(markdown: string, pagePath: string): string {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return pagePath.split('/').pop() ?? pagePath;
}
