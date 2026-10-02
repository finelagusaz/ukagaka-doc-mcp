/**
 * 里々 docs パーサー
 *
 * docs/satori-docs/{dir}/*.md（git submodule: ukatech/satori-docs）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。
 *
 * 設計方針:
 * - 1ページ = 1エントリ（yaya-docs と同じ）
 * - リポジトリ直下の INDEX.md（目次）は走査対象外
 * - 各ディレクトリの index.md は目次ではなく本文（呼び出し規則など）を持つため取り込む。
 *   上流サイトは navigation.indexes によりディレクトリ URL（functions/）で配信する
 * - 対象ディレクトリは上流 .nav.yml の nav と対応させる
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Category, DocEntry } from '../types.js';
import { markdownToPlainText } from './markdown.js';

const SATORI_DOCS_BASE_URL = 'https://ukatech.github.io/satori-docs/';
const SATORI_DOCS_RAW_BASE_URL = 'https://raw.githubusercontent.com/ukatech/satori-docs/refs/heads/main/';

/** ディレクトリ → カテゴリ（上流 .nav.yml の nav 順） */
const DIR_CATEGORIES: Record<string, Category> = {
  startup: 'satori_startup',
  grammar: 'satori_grammar',
  shiori: 'satori_shiori',
  system: 'satori_system',
  functions: 'satori_function',
  ssu: 'satori_ssu',
  other: 'satori_other',
};

/** ページ本文を持たないディレクトリ */
const NON_CONTENT_DIRS = new Set(['assets', 'scripts', 'overrides']);

/**
 * satori-docs リポジトリ内の Markdown を全てパースして DocEntry 配列を返す。
 * 未知のディレクトリは警告を出してスキップする（上流の構成変更の検知手段）。
 */
export function parseSatoriDocs(rootDir: string): DocEntry[] {
  if (!existsSync(rootDir)) {
    throw new Error(`Satori docs directory not found: ${rootDir}\nRun: git submodule update --init --recursive`);
  }

  const dirs = readdirSync(rootDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.') && !NON_CONTENT_DIRS.has(dirent.name))
    .map(dirent => dirent.name)
    .sort();

  const entries: DocEntry[] = [];

  for (const dir of dirs) {
    const category = DIR_CATEGORIES[dir];
    if (!category) {
      console.error(`[satori-docs-parser] Warning: unknown directory, skipped: ${dir}`);
      continue;
    }

    const files = readdirSync(join(rootDir, dir))
      .filter(file => file.endsWith('.md'))
      .sort();

    for (const file of files) {
      const stem = file.replace(/\.md$/, '');
      const pagePath = `${dir}/${stem}`;
      const encodedDir = encodeURIComponent(dir);
      const encodedPath = `${encodedDir}/${encodeURIComponent(stem)}`;
      const raw = readFileSync(join(rootDir, dir, file), 'utf-8');
      const content = markdownToPlainText(raw);
      if (!content) continue;

      entries.push({
        id: `satori:${pagePath}`,
        title: extractTitle(raw, pagePath),
        source: 'satori_docs',
        category,
        content,
        url: stem === 'index' ? `${SATORI_DOCS_BASE_URL}${encodedDir}/` : `${SATORI_DOCS_BASE_URL}${encodedPath}/`,
        rawUrl: `${SATORI_DOCS_RAW_BASE_URL}${encodedPath}.md`,
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
