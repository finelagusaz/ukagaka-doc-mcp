/**
 * mdBook ソース共通パーサー（湊 docs / Pasta docs パーサー共用）
 *
 * 設計方針:
 * - 既定は 1ページ = 1エントリ（yaya-docs / satori-docs と同じ）。
 *   splitSections を有効にすると `##` 見出しごとに分ける（ukadoc と同じ粒度）
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
  /**
   * ページを `##` 見出しごとのエントリに分ける。最初の `##` より前（h1 と導入文）は
   * ページ id のエントリ、各 `##` 以降は `{ページ id}:{見出しアンカー}` のエントリになる
   */
  splitSections?: boolean;
  /**
   * 各ページの最初の `---` より前（h1 は残す）と最後の `---` より後を本文から除く。
   * Pasta docs は案内役の口上をこの位置に置いているため、summary と検索対象から外す
   */
  stripFraming?: boolean;
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
    const lines = raw.split(/\r?\n/);
    const body = config.stripFraming ? stripFraming(lines, path, config.logTag) : lines;

    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const htmlPath = encodedPath.replace(/(^|\/)README$/, '$1index');
    const pageId = `${config.idPrefix}:${path}`;
    const pageUrl = `${config.baseUrl}${htmlPath}.html`;
    const pageTitle = extractTitle(raw) ?? label;
    const rawUrl = `${config.rawBaseUrl}${encodedPath}.md`;
    const entry = (id: string, title: string, content: string, url: string): DocEntry => (
      { id, title, source: config.source, category, content, url, rawUrl }
    );

    if (!config.splitSections) {
      const content = markdownToPlainText(body.join('\n'));
      if (!content) continue;
      entries.push(entry(pageId, pageTitle, content, pageUrl));
      continue;
    }

    for (const section of splitSections(body)) {
      const content = markdownToPlainText(section.lines.join('\n'));
      if (section.anchor === undefined) {
        // 導入部が見出しだけ（h1 の直後に ## が来る）ならページのエントリは作らない
        if (content && content !== pageTitle) {
          entries.push(entry(pageId, pageTitle, content, pageUrl));
        }
        continue;
      }
      if (!content) continue;
      entries.push(entry(`${pageId}:${section.anchor}`, `${pageTitle} - ${section.heading}`, content, `${pageUrl}#${section.anchor}`));
    }
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

/** コードフェンスの外にある行だけを true にした配列を返す（見出し・区切り線の判定用） */
function outsideFences(lines: string[]): boolean[] {
  let fence: string | null = null;
  return lines.map(line => {
    const marker = line.match(/^(```|~~~)/)?.[1];
    if (marker) {
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return false;
    }
    return fence === null;
  });
}

/**
 * 最初の `---` までの口上（h1 は残す）と最後の `---` 以降の口上を除く。
 * `---` が2本未満なら上流の書式が変わったとみなして警告し、ページ全体を残す。
 */
function stripFraming(lines: string[], path: string, logTag: string): string[] {
  const outside = outsideFences(lines);
  const rules = lines.flatMap((line, i) => (outside[i] && /^---\s*$/.test(line) ? [i] : []));
  if (rules.length < 2) {
    console.error(`[${logTag}] Warning: framing rules (---) not found, kept whole page: ${path}`);
    return lines;
  }
  const h1 = lines.findIndex((line, i) => outside[i] && /^#\s/.test(line));
  const head = h1 !== -1 && h1 < rules[0] ? [lines[h1]] : [];
  return [...head, ...lines.slice(rules[0] + 1, rules[rules.length - 1])];
}

interface Section {
  /** `##` 見出しの表示テキスト（導入部は undefined） */
  heading?: string;
  /** mdBook が付ける見出しの id（導入部は undefined） */
  anchor?: string;
  lines: string[];
}

/**
 * `##` 見出しで分割する。先頭要素は最初の `##` より前の導入部。
 * アンカーは mdBook と同じく全見出し（h1〜h6）を出現順に数えて重複に `-1` `-2` … を付ける。
 */
function splitSections(lines: string[]): Section[] {
  const outside = outsideFences(lines);
  const idCounts = new Map<string, number>();
  const sections: Section[] = [{ lines: [] }];

  lines.forEach((line, i) => {
    const heading = outside[i] ? line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/) : null;
    if (!heading) {
      sections[sections.length - 1].lines.push(line);
      return;
    }
    const text = markdownToPlainText(heading[2]);
    const id = mdBookHeadingId(text);
    const count = idCounts.get(id) ?? 0;
    idCounts.set(id, count + 1);
    if (heading[1] === '##') {
      sections.push({ heading: text, anchor: count === 0 ? id : `${id}-${count}`, lines: [line] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  });

  return sections;
}

/**
 * mdBook（utils::normalize_id）と同じ規則で見出しテキストから id を作る:
 * 英数字（Unicode の Alphabetic / Numeric）・`_`・`-` を残して ASCII だけ小文字化し、空白は `-`、他の記号は落とす
 */
export function mdBookHeadingId(text: string): string {
  return [...text]
    .map(ch => {
      if (/[\p{Alphabetic}\p{N}_-]/u.test(ch)) return ch.replace(/[A-Z]/, c => c.toLowerCase());
      if (/\s/u.test(ch)) return '-';
      return '';
    })
    .join('');
}

/** 先頭 h1 見出し（無ければ呼び出し側で目次の表示名を使う） */
function extractTitle(markdown: string): string | undefined {
  return markdown.match(/^#\s+(.+)$/m)?.[1].trim();
}
