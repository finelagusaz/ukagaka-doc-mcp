/**
 * 湊 docs パーサー
 *
 * docs/minato/docs/src/**\/*.md（git submodule: mizuki-yura/minato）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。
 *
 * 設計方針:
 * - 1ページ = 1エントリ（yaya-docs / satori-docs と同じ）
 * - 対象ページは上流サイト（mdBook）の目次 SUMMARY.md から決める（ssphelp と同じ）。
 *   目次に無い Markdown は mdBook も出力しないため取り込まない
 * - カテゴリはページパスの先頭要素（ディレクトリ、直下のファイルはファイル名）から決める
 * - mdBook は README.md を index.html として出力する
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Category, DocEntry } from '../types.js';
import { markdownToPlainText } from './markdown.js';

const MINATO_DOCS_BASE_URL = 'https://mizuki-yura.github.io/minato/';
const MINATO_DOCS_RAW_BASE_URL = 'https://raw.githubusercontent.com/mizuki-yura/minato/refs/heads/master/docs/src/';

/** ページパスの先頭要素 → カテゴリ（上流 SUMMARY.md の章立てに対応） */
const TOP_CATEGORIES: Record<string, Category> = {
  README: 'minato_startup',
  intro: 'minato_startup',
  basic: 'minato_basic',
  data: 'minato_grammar',
  control: 'minato_grammar',
  func: 'minato_grammar',
  include: 'minato_grammar',
  talk: 'minato_talk',
  saori: 'minato_other',
  config: 'minato_other',
  error: 'minato_other',
  migration: 'minato_migration',
};

interface TocPage {
  /** src からの相対パス（拡張子 .md なし、区切りは /） */
  path: string;
  /** 目次上の表示名 */
  label: string;
}

/**
 * mdBook のソースディレクトリ（SUMMARY.md のあるディレクトリ）を全てパースして DocEntry 配列を返す。
 * 未知の先頭要素・目次に無いページ・目次にあるが存在しないページは警告を出してスキップする
 * （上流の構成変更の検知手段）。
 */
export function parseMinatoDocs(srcDir: string): DocEntry[] {
  const summaryPath = join(srcDir, 'SUMMARY.md');
  if (!existsSync(summaryPath)) {
    throw new Error(`Minato docs source not found: ${summaryPath}\nRun: git submodule update --init --recursive`);
  }

  const toc = parseSummary(readFileSync(summaryPath, 'utf-8'));
  const listed = new Set(toc.map(page => page.path));

  for (const path of listMarkdownPaths(srcDir)) {
    if (path !== 'SUMMARY' && !listed.has(path)) {
      console.error(`[minato-docs-parser] Warning: page not in SUMMARY.md, skipped: ${path}`);
    }
  }

  const entries: DocEntry[] = [];

  for (const { path, label } of toc) {
    const category = TOP_CATEGORIES[path.split('/')[0]];
    if (!category) {
      console.error(`[minato-docs-parser] Warning: unknown section, skipped: ${path}`);
      continue;
    }

    const filePath = join(srcDir, `${path}.md`);
    if (!existsSync(filePath)) {
      console.error(`[minato-docs-parser] Warning: page listed in SUMMARY.md not found: ${path}`);
      continue;
    }

    const raw = readFileSync(filePath, 'utf-8');
    const content = markdownToPlainText(raw);
    if (!content) continue;

    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const htmlPath = encodedPath.replace(/(^|\/)README$/, '$1index');

    entries.push({
      id: `minato:${path}`,
      title: extractTitle(raw) ?? label,
      source: 'minato_docs',
      category,
      content,
      url: `${MINATO_DOCS_BASE_URL}${htmlPath}.html`,
      rawUrl: `${MINATO_DOCS_RAW_BASE_URL}${encodedPath}.md`,
    });
  }

  return entries;
}

/**
 * SUMMARY.md から目次のページを出現順に読む。
 * 前付け（`[はじめに](README.md)`）も入れ子のリスト項目も `[表示名](パス.md)` の形なのでリンクだけを拾う。
 * パスの空なリンク（mdBook の下書き章）は対象外。
 */
export function parseSummary(summary: string): TocPage[] {
  const pages: TocPage[] = [];
  const seen = new Set<string>();

  for (const line of summary.split(/\r?\n/)) {
    const link = line.match(/^\s*(?:[-*]\s+)?\[(.+)\]\(([^)]*\.md)\)\s*$/);
    if (!link) continue;
    const path = link[2].replace(/^\.\//, '').replace(/\.md$/, '');
    if (seen.has(path)) continue;
    seen.add(path);
    pages.push({ path, label: link[1].trim() });
  }

  return pages;
}

/** srcDir 以下の Markdown を相対パス（拡張子なし）で列挙する */
function listMarkdownPaths(srcDir: string): string[] {
  return readdirSync(srcDir, { recursive: true, encoding: 'utf-8' })
    .filter(file => file.endsWith('.md'))
    .map(file => relative(srcDir, join(srcDir, file)).split(sep).join('/').replace(/\.md$/, ''))
    .sort();
}

/** 先頭 h1 見出し（無ければ呼び出し側で目次の表示名を使う） */
function extractTitle(markdown: string): string | undefined {
  return markdown.match(/^#\s+(.+)$/m)?.[1].trim();
}
