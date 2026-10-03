/**
 * mdBook ソース共通パーサー（湊 docs / Pasta docs パーサー共用）
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
import type { Category, DocEntry, Source } from '../types.js';
import { markdownToPlainText } from './markdown.js';

export interface MdBookConfig {
  /** id の接頭辞（`{idPrefix}:{path}`） */
  idPrefix: string;
  source: Source;
  /** 公開サイトのルート URL（末尾 /） */
  baseUrl: string;
  /** src ディレクトリに対応する生 Markdown のルート URL（末尾 /） */
  rawBaseUrl: string;
  /** ページパスの先頭要素 → カテゴリ（上流 SUMMARY.md の章立てに対応） */
  topCategories: Record<string, Category>;
  /** 警告ログの接頭辞（例: minato-docs-parser） */
  logTag: string;
  /** SUMMARY.md が無いときのエラーメッセージに出す名前（例: Minato docs） */
  displayName: string;
}

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
export function parseMdBook(srcDir: string, config: MdBookConfig): DocEntry[] {
  const summaryPath = join(srcDir, 'SUMMARY.md');
  if (!existsSync(summaryPath)) {
    throw new Error(`${config.displayName} source not found: ${summaryPath}\nRun: git submodule update --init --recursive`);
  }

  const toc = parseSummary(readFileSync(summaryPath, 'utf-8'));
  const listed = new Set(toc.map(page => page.path));

  for (const path of listMarkdownPaths(srcDir)) {
    if (path !== 'SUMMARY' && !listed.has(path)) {
      console.error(`[${config.logTag}] Warning: page not in SUMMARY.md, skipped: ${path}`);
    }
  }

  const entries: DocEntry[] = [];

  for (const { path, label } of toc) {
    const category = config.topCategories[path.split('/')[0]];
    if (!category) {
      console.error(`[${config.logTag}] Warning: unknown section, skipped: ${path}`);
      continue;
    }

    const filePath = join(srcDir, `${path}.md`);
    if (!existsSync(filePath)) {
      console.error(`[${config.logTag}] Warning: page listed in SUMMARY.md not found: ${path}`);
      continue;
    }

    const raw = readFileSync(filePath, 'utf-8');
    const content = markdownToPlainText(raw);
    if (!content) continue;

    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const htmlPath = encodedPath.replace(/(^|\/)README$/, '$1index');

    entries.push({
      id: `${config.idPrefix}:${path}`,
      title: extractTitle(raw) ?? label,
      source: config.source,
      category,
      content,
      url: `${config.baseUrl}${htmlPath}.html`,
      rawUrl: `${config.rawBaseUrl}${encodedPath}.md`,
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
