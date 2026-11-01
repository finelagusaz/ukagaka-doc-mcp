/**
 * UKADOC パーサー
 *
 * docs/ukadoc-spec（git submodule: ukatech/ukadoc-spec）の Markdown をローカルでパースする。
 * UKADOC の正本は ukatech/ukadoc の manual/*.html（アーカイブ扱い）から ukadoc-spec に移った。
 *
 * 上流の構成:
 * - `descript/<種別>/` `list/<名前>/` `spec/<名前>/` は、ディレクトリ 1 つが旧 HTML の 1 ページにあたる。
 *   その下にカテゴリのディレクトリがあり、さらにその下に 1 項目 1 ファイルの `.md` が並ぶ。
 *   公開サイトは、index.md を持つディレクトリを 1 ページ（`<ディレクトリ>/`）にまとめ、項目を見出しのアンカーで指す
 * - 次のものは 1 ファイル 1 ページで配信される（index.md はディレクトリの URL）
 *   - `manual/` `dev/` `memo/` の下のファイル（入れ子のディレクトリも含む）
 *   - ディレクトリを持たない `spec/*.md`
 *   - index.md を持たないディレクトリの下のファイル
 * - まとめたページの index.md は、`## 一覧` から後ろが目次。その前に本文（カテゴリの説明）があるものだけを取り込む
 *
 * 設計方針:
 * - 1 ファイル = 1 エントリ。id は `ukadoc:{リポジトリ直下からのパス stem}`
 * - 本文の `**カテゴリ:**` 行は除き、代わりに祖先の index.md の H1 をつないだパンくずを先頭に置く
 *   （ghost と shell の `charset` など、同じ名前の項目を見分けるため）
 * - 未知のページ（ディレクトリ・ファイル）は警告を出してスキップする（上流の構成変更の検知手段）
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { Category, DocEntry } from '../types.js';
import { markdownToPlainText } from './markdown.js';
import { listMarkdownFiles, sortedDirents } from './mkdocs.js';

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
 * `manual` `dev` `memo` の下のファイルは、ファイルごとの指定（`memo/shiori-event`）が無ければ直下のディレクトリ名で引く。
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

/** 上流 prepare_site.py の INDEX_SECTION と同じく、この行から後ろが目次 */
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
        if (!page.isDirectory() && !page.name.endsWith('.md')) continue;
        const category = lookupPageCategory(pagePath);
        if (!category) {
          console.error(`[${LOG_TAG}] Warning: unknown page, skipped: ${pagePath}`);
          continue;
        }
        if (!page.isDirectory()) {
          pushEntry(entries, parseStandalonePage(rootDir, `${pagePath}.md`, category));
        } else if (existsSync(join(rootDir, pagePath, 'index.md'))) {
          entries.push(...parseBundle(rootDir, pagePath, category));
        } else {
          // 上流は index.md を持つディレクトリだけを 1 ページにまとめる。持たなければ各ファイルが 1 ページ
          for (const file of listMarkdownFiles(rootDir, pagePath)) {
            pushEntry(entries, parseStandalonePage(rootDir, file, category));
          }
        }
      }
    } else if (PAGE_ROOTS.has(top.name)) {
      // 上流は入れ子のディレクトリも含めて 1 ファイル 1 ページで配信する
      for (const file of listMarkdownFiles(rootDir, top.name)) {
        const category = lookupPageCategory(file.replace(/\.md$/, '')) ?? lookupPageCategory(top.name);
        if (category) pushEntry(entries, parseStandalonePage(rootDir, file, category));
      }
    } else {
      console.error(`[${LOG_TAG}] Warning: unknown directory, skipped: ${top.name}`);
    }
  }

  return entries;
}

/**
 * 1 ファイル 1 ページ（manual/ghost.md、spec/plugin.md など）を 1 エントリにする。
 * index.md はディレクトリの URL で配信される。まとめたページではないので「## 一覧」もそのまま本文に残る
 */
function parseStandalonePage(rootDir: string, file: string, category: Category): DocEntry | undefined {
  const raw = readFileSync(join(rootDir, file), 'utf-8');
  const stem = file.replace(/\.md$/, '');
  const urlPath = isIndex(file) ? posix.dirname(file) : stem;
  return buildEntry(raw, stem, category, [], `${BASE_URL}${encodePath(urlPath)}/`);
}

/**
 * ディレクトリ 1 つを 1 ページにまとめて配信するもの（list/shiori-event など）の各項目をエントリにする。
 * 項目の URL は、まとめたページの見出しのアンカー。
 * アンカーは、上流 scripts/prepare_site.py の register_bundle と同じ規則で決める。
 * - 原則は項目のファイル名の stem（index.md はディレクトリ名）
 * - ページ内で重なるときは、ページからのパスを `-` でつないだもの
 * - ページ自身の index.md が重なるときは `{名前}-page`
 */
function parseBundle(rootDir: string, pagePath: string, category: Category): DocEntry[] {
  const files = listMarkdownFiles(rootDir, pagePath);
  const raws = new Map(files.map(file => [file, readFileSync(join(rootDir, file), 'utf-8')]));
  const pageUrl = `${BASE_URL}${encodePath(pagePath)}/`;

  const candidates = new Map(files.map(file => [
    file,
    posix.basename(isIndex(file) ? posix.dirname(file) : file.replace(/\.md$/, '')),
  ]));
  const counts = new Map<string, number>();
  for (const c of candidates.values()) counts.set(c, (counts.get(c) ?? 0) + 1);

  const anchorOf = (file: string): string => {
    const c = candidates.get(file) ?? '';
    if ((counts.get(c) ?? 0) <= 1) return c;
    const sub = posix.relative(pagePath, isIndex(file) ? posix.dirname(file) : file.replace(/\.md$/, ''));
    return sub === '' ? `${c}-page` : sub.replace(/\//g, '-');
  };

  // パンくずに使う、各ディレクトリの index.md の H1
  const headings = new Map<string, string>();
  for (const [file, raw] of raws) {
    if (isIndex(file)) headings.set(posix.dirname(file), extractTitle(raw) ?? '');
  }

  const entries: DocEntry[] = [];
  for (const [file, raw] of raws) {
    // ページ自身から項目の親ディレクトリまでの index.md の H1（index.md 自身の H1 は含めない）
    const parts = posix.relative(pagePath, posix.dirname(file)).split('/').filter(Boolean);
    const dirs = [pagePath, ...parts.map((_, i) => posix.join(pagePath, ...parts.slice(0, i + 1)))];
    if (isIndex(file)) dirs.pop();
    const ancestors = dirs.map(d => headings.get(d)).filter((h): h is string => !!h);

    // 上流 unit_body と同じく、index.md は「## 一覧」から後ろを全て捨てる
    const body = isIndex(file) ? raw.split(INDEX_SECTION, 1)[0] : raw;
    const isPageIndex = file === `${pagePath}/index.md`;
    const url = isPageIndex ? pageUrl : `${pageUrl}#${encodeURIComponent(anchorOf(file))}`;
    pushEntry(entries, buildEntry(body, file.replace(/\.md$/, ''), category, ancestors, url));
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
  const body = raw.replace(CATEGORY_LINE, '');
  // H1 しか残らないもの（目次だけの index.md など）は取り込まない
  if (!body.replace(/^#\s+.*$/m, '').trim()) return undefined;

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

function lookupPageCategory(pagePath: string): Category | undefined {
  // 継承プロパティ（constructor 等）に当たらないよう自身のキーだけを引く
  return Object.hasOwn(PAGE_CATEGORIES, pagePath) ? PAGE_CATEGORIES[pagePath] : undefined;
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
