/**
 * MkDocs 系サイトの Markdown リポジトリ共通パーサー（里々 docs / 華和梨 docs パーサー共用）
 *
 * 設計方針:
 * - 1ページ = 1エントリ（yaya-docs と同じ）
 * - リポジトリ直下のファイル（目次の INDEX.md など）は走査対象外
 * - 各ディレクトリの index.md は目次ではなく本文（呼び出し規則など）を持つため取り込む。
 *   上流サイトは navigation.indexes によりディレクトリ URL（functions/）で配信する
 * - 対象ディレクトリは上流 .nav.yml の nav と対応させる
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Category, DocEntry, Source } from '../types.js';
import { markdownToPlainText } from './markdown.js';

export interface MkDocsConfig {
  /** id の接頭辞（`{idPrefix}:{dir}/{file_stem}`） */
  idPrefix: string;
  source: Source;
  /** 公開サイトのルート URL（末尾 /） */
  baseUrl: string;
  /** リポジトリ直下に対応する生 Markdown のルート URL（末尾 /） */
  rawBaseUrl: string;
  /** ディレクトリ → カテゴリ（上流 .nav.yml の nav 順） */
  dirCategories: Record<string, Category>;
  /** 警告ログの接頭辞（例: satori-docs-parser） */
  logTag: string;
  /** ディレクトリが無いときのエラーメッセージに出す名前（例: Satori docs） */
  displayName: string;
}

/** ページ本文を持たないディレクトリ */
const NON_CONTENT_DIRS = new Set(['assets', 'scripts', 'overrides']);

/**
 * リポジトリ内の Markdown を全てパースして DocEntry 配列を返す。
 * 未知のディレクトリは警告を出してスキップする（上流の構成変更の検知手段）。
 */
export function parseMkDocs(rootDir: string, config: MkDocsConfig): DocEntry[] {
  if (!existsSync(rootDir)) {
    throw new Error(`${config.displayName} directory not found: ${rootDir}\nRun: git submodule update --init --recursive`);
  }

  const dirs = readdirSync(rootDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.') && !NON_CONTENT_DIRS.has(dirent.name))
    .map(dirent => dirent.name)
    .sort();

  const entries: DocEntry[] = [];

  for (const dir of dirs) {
    // 継承プロパティ（constructor 等）に当たらないよう自身のキーだけを引く
    const category = Object.hasOwn(config.dirCategories, dir) ? config.dirCategories[dir] : undefined;
    if (!category) {
      console.error(`[${config.logTag}] Warning: unknown directory, skipped: ${dir}`);
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
        id: `${config.idPrefix}:${pagePath}`,
        title: extractTitle(raw, pagePath),
        source: config.source,
        category,
        content,
        url: stem === 'index' ? `${config.baseUrl}${encodedDir}/` : `${config.baseUrl}${encodedPath}/`,
        rawUrl: `${config.rawBaseUrl}${encodedPath}.md`,
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
