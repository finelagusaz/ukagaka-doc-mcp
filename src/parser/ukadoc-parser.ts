/**
 * UKADOC パーサー
 *
 * docs/ukadoc-spec（git submodule: ukatech/ukadoc-spec）の Markdown をローカルでパースする。
 * UKADOC の正本は ukatech/ukadoc の manual/*.html（アーカイブ扱い）から ukadoc-spec に移った。
 *
 * 上流の構成:
 * - `descript/<種別>/` `list/<名前>/` `spec/<名前>/` はディレクトリ 1 つが旧 HTML の 1 ページで、
 *   その下にカテゴリのディレクトリ、さらにその下に 1 項目 1 ファイルの `.md` が並ぶ。
 *   公開サイトはディレクトリごとに 1 ページ（`<ディレクトリ>/`）へまとめ、項目は見出しのアンカーで指す
 * - `manual/` `dev/` `memo/` と、ディレクトリを持たない `spec/*.md` は 1 ファイル 1 ページ
 * - 各 `index.md` の `## 一覧` は目次。その前に本文（カテゴリの説明）を持つものだけ取り込む
 *
 * 設計方針:
 * - 1 ファイル = 1 エントリ。id は `ukadoc:{リポジトリ直下からのパス stem}`
 * - 本文の `**カテゴリ:**` 行は除き、代わりに祖先の index.md の H1 をつないだパンくずを先頭に置く
 *   （ghost と shell の `charset` など、同じ名前の項目を見分けるため）
 * - 未知のページ（ディレクトリ・ファイル）は警告を出してスキップする（上流の構成変更の検知手段）
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { Category, DocEntry } from '../types.js';
import { markdownToPlainText } from './markdown.js';

const BASE_URL = 'https://ukatech.shillest.net/ukadoc-spec/';
const RAW_BASE_URL = 'https://raw.githubusercontent.com/ukatech/ukadoc-spec/refs/heads/main/';
const LOG_TAG = 'ukadoc-parser';

/** ディレクトリ 1 つを 1 ページにまとめて配信する直下のディレクトリ */
const BUNDLE_ROOTS = new Set(['descript', 'list', 'spec']);

/** 1 ファイル 1 ページの直下のディレクトリ */
const PAGE_ROOTS = new Set(['manual', 'dev', 'memo']);

/** ページ本文を持たない直下のディレクトリ */
const NON_CONTENT_DIRS = new Set(['assets', 'migration', 'scripts', 'site_ext']);

/**
 * ページ → カテゴリ（上流 .nav.yml の nav 順）。
 * キーはページのパス（`list/sakura-script`、`spec/plugin` のように .md を除く）。
 * 1 ファイル 1 ページのディレクトリは、直下のディレクトリ名でまとめて引く（個別の指定が優先）。
 */
const PAGE_CATEGORIES: Record<string, Category> = {
  'manual':                     'file_structure',
  'descript/ghost':             'descript',
  'descript/shell':             'descript',
  'descript/shell-surfaces':    'descript',
  'descript/shell-surfacetable': 'descript',
  'descript/balloon':           'descript',
  'descript/plugin':            'descript',
  'descript/headline':          'descript',
  'descript/install':           'descript',
  'spec/update-file':           'protocol',
  'list/sakura-script':         'sakurascript',
  'list/propertysystem':        'protocol',
  'list/shiori-event':          'shiori_event',
  'list/shiori-event-ex':       'shiori_event',
  'list/shiori-resource':       'shiori_event',
  'list/plugin-event':          'shiori_event',
  'spec/shiori3':               'protocol',
  'spec/sstp':                  'protocol',
  'spec/saori-ex':              'protocol',
  'spec/plugin':                'protocol',
  'spec/headline':              'protocol',
  'spec/dll':                   'protocol',
  'spec/fmo-mutex':             'protocol',
  'spec/web':                   'protocol',
  'dev':                        'dev_guide',
  'memo/shiori-event':          'shiori_event',
  'memo':                       'dev_guide',
};

const INDEX_SECTION = /^## 一覧[ \t]*$/m;
const CATEGORY_LINE = /^\*\*カテゴリ:\*\*.*\n?/m;

/**
 * ukadoc-spec リポジトリ内の Markdown を全てパースして DocEntry 配列を返す。
 */
export function parseUkadoc(rootDir: string): DocEntry[] {
  if (!existsSync(rootDir)) {
    throw new Error(`UKADOC directory not found: ${rootDir}\nRun: git submodule update --init --recursive`);
  }

  const entries: DocEntry[] = [];

  for (const top of sortedDirents(rootDir)) {
    if (!top.isDirectory() || top.name.startsWith('.') || NON_CONTENT_DIRS.has(top.name)) continue;

    if (BUNDLE_ROOTS.has(top.name)) {
      for (const page of sortedDirents(join(rootDir, top.name))) {
        const pagePath = `${top.name}/${page.name.replace(/\.md$/, '')}`;
        if (page.isDirectory()) {
          const category = lookupCategory(pagePath);
          if (category) entries.push(...parseBundle(rootDir, pagePath, category));
        } else if (page.name.endsWith('.md')) {
          const category = lookupCategory(pagePath);
          if (category) pushEntry(entries, parseStandalonePage(rootDir, `${pagePath}.md`, category));
        }
      }
    } else if (PAGE_ROOTS.has(top.name)) {
      for (const page of sortedDirents(join(rootDir, top.name))) {
        if (!page.isFile() || !page.name.endsWith('.md')) continue;
        const pagePath = `${top.name}/${page.name.replace(/\.md$/, '')}`;
        const category = lookupCategory(pagePath) ?? lookupCategory(top.name);
        if (category) pushEntry(entries, parseStandalonePage(rootDir, `${pagePath}.md`, category));
      }
    } else {
      console.error(`[${LOG_TAG}] Warning: unknown directory, skipped: ${top.name}`);
    }
  }

  return entries;
}

/** 1 ファイル 1 ページ（manual/ghost.md、spec/plugin.md など）を 1 エントリにする */
function parseStandalonePage(rootDir: string, file: string, category: Category): DocEntry | undefined {
  const raw = readFileSync(join(rootDir, file), 'utf-8');
  const stem = file.replace(/\.md$/, '');
  return buildEntry(raw, stem, category, [], `${BASE_URL}${encodePath(stem)}/`);
}

/**
 * ディレクトリ 1 つを 1 ページにまとめて配信するもの（list/shiori-event など）の各項目をエントリにする。
 * 項目の URL は、まとめたページの見出しのアンカー。アンカーは上流 scripts/prepare_site.py の
 * register_bundle と同じ規則で決める: 項目のファイル名の stem（index.md はディレクトリ名）で、
 * ページ内で重なるときはページからのパスを `-` でつないだもの（ページ自身の index.md は `{名前}-page`）。
 */
function parseBundle(rootDir: string, pagePath: string, category: Category): DocEntry[] {
  const files = listMarkdownFiles(rootDir, pagePath);
  const pageUrl = `${BASE_URL}${encodePath(pagePath)}/`;

  const candidate = (file: string) => posix.basename(isIndex(file) ? posix.dirname(file) : file.replace(/\.md$/, ''));
  const counts = new Map<string, number>();
  for (const file of files) counts.set(candidate(file), (counts.get(candidate(file)) ?? 0) + 1);

  const anchorOf = (file: string): string => {
    const c = candidate(file);
    if ((counts.get(c) ?? 0) <= 1) return c;
    const sub = posix.relative(pagePath, isIndex(file) ? posix.dirname(file) : file.replace(/\.md$/, ''));
    return sub === '' ? `${c}-page` : sub.replace(/\//g, '-');
  };

  // パンくずに使う、各ディレクトリの index.md の H1
  const headings = new Map<string, string>();
  for (const file of files) {
    if (isIndex(file)) headings.set(posix.dirname(file), extractTitle(readFileSync(join(rootDir, file), 'utf-8')) ?? '');
  }

  const entries: DocEntry[] = [];
  for (const file of files) {
    const raw = readFileSync(join(rootDir, file), 'utf-8');
    // ページ自身から項目の親ディレクトリまでの index.md の H1（index.md 自身の H1 は含めない）
    const parts = posix.relative(pagePath, posix.dirname(file)).split('/').filter(Boolean);
    const dirs = [pagePath, ...parts.map((_, i) => posix.join(pagePath, ...parts.slice(0, i + 1)))];
    if (isIndex(file)) dirs.pop();
    const ancestors = dirs.map(d => headings.get(d)).filter((h): h is string => !!h);

    const isPageIndex = file === `${pagePath}/index.md`;
    const url = isPageIndex ? pageUrl : `${pageUrl}#${encodeURIComponent(anchorOf(file))}`;
    pushEntry(entries, buildEntry(raw, file.replace(/\.md$/, ''), category, ancestors, url));
  }
  return entries;
}

function buildEntry(
  raw: string,
  stem: string,
  category: Category,
  ancestors: string[],
  url: string,
): DocEntry | undefined {
  const indexFile = posix.basename(stem) === 'index';
  let body = raw;
  if (indexFile) {
    // 「## 一覧」から後ろ（次の ## 見出しまで）は目次なので除く
    const match = INDEX_SECTION.exec(body);
    if (match) {
      const after = body.slice(match.index + match[0].length);
      const next = after.search(/^## /m);
      body = body.slice(0, match.index) + (next === -1 ? '' : after.slice(next));
    }
    // H1 しか残らない目次だけの index.md は取り込まない
    if (!body.replace(/^#\s+.*$/m, '').trim()) return undefined;
  }
  body = body.replace(CATEGORY_LINE, '');

  const text = markdownToPlainText(body);
  if (!text) return undefined;

  const title = extractTitle(raw) ?? posix.basename(stem);
  return {
    id: `ukadoc:${stem}`,
    title,
    source: 'ukadoc',
    category,
    content: ancestors.length > 0 ? `[${ancestors.join(' > ')}]\n${text}` : text,
    url,
    rawUrl: `${RAW_BASE_URL}${encodePath(stem)}.md`,
  };
}

// ============================================================
// ユーティリティ
// ============================================================

function lookupCategory(pagePath: string): Category | undefined {
  // 継承プロパティ（constructor 等）に当たらないよう自身のキーだけを引く
  if (Object.hasOwn(PAGE_CATEGORIES, pagePath)) return PAGE_CATEGORIES[pagePath];
  if (!PAGE_ROOTS.has(pagePath.split('/')[0])) {
    console.error(`[${LOG_TAG}] Warning: unknown page, skipped: ${pagePath}`);
  }
  return undefined;
}

function pushEntry(entries: DocEntry[], entry: DocEntry | undefined): void {
  if (entry) entries.push(entry);
}

function isIndex(file: string): boolean {
  return posix.basename(file) === 'index.md';
}

/** 先頭 H1 をプレーンテキストにしたもの（さくらスクリプトのタグはコードスパンで書かれている） */
function extractTitle(markdown: string): string | undefined {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  return h1 ? markdownToPlainText(h1[1]).trim() || undefined : undefined;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function sortedDirents(dir: string) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** dir（rootDir からの相対、区切りは /）以下の Markdown を、入れ子のディレクトリも含めて名前順に返す */
function listMarkdownFiles(rootDir: string, dir: string): string[] {
  const files: string[] = [];
  for (const dirent of sortedDirents(join(rootDir, dir))) {
    const path = `${dir}/${dirent.name}`;
    if (dirent.isDirectory()) {
      if (!dirent.name.startsWith('.')) files.push(...listMarkdownFiles(rootDir, path));
    } else if (dirent.name.endsWith('.md')) {
      files.push(path);
    }
  }
  return files;
}
