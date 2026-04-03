/**
 * YAYA Wiki スクレイパー
 *
 * https://emily.shillest.net/ayaya/ (PukiWiki Plus!)
 *
 * 設計方針:
 * - YAYA関数ページ（マニュアル/関数/*）は1ページ=1エントリ（情報断片化防止）
 * - その他のページはセクション(h2/h3)単位で分割
 * - レート制限: 500ms/リクエスト
 */

import { SCRAPE_RATE_LIMIT_MS } from '../constants.js';
import type { DocEntry, Category } from '../types.js';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://emily.shillest.net/ayaya/';
const INVALID_PAGE_MARKERS = ['有効なWikiNameではありません'];

// ============================================================
// スクレイプ対象ページ定義
// ============================================================

interface YayaPageDef {
  path: string;         // Wiki ページパス (例: 'マニュアル/関数/REPLACE')
  category: Category;
  onePageOneEntry?: boolean; // true の場合セクション分割しない
}

/** スクレイプ対象ページ一覧。ビルド時に動的取得するページのベース。 */
export const YAYA_STATIC_PAGES: YayaPageDef[] = [
  // -- マニュアル/文法 --
  { path: 'マニュアル/文法/基礎設定',       category: 'yaya_grammar' },
  { path: 'マニュアル/文法/関数定義',       category: 'yaya_grammar' },
  { path: 'マニュアル/文法/変数',           category: 'yaya_grammar' },
  { path: 'マニュアル/文法/演算',           category: 'yaya_grammar' },
  { path: 'マニュアル/文法/配列',           category: 'yaya_grammar' },
  { path: 'マニュアル/文法/フロー制御',     category: 'yaya_grammar' },
  { path: 'マニュアル/文法/プリプロセッサ', category: 'yaya_grammar' },
  { path: 'マニュアル/文法/予約語',         category: 'yaya_grammar' },
  { path: 'マニュアル/文法/DLL仕様',        category: 'yaya_grammar' },
  { path: 'マニュアル/文法/文字コード',     category: 'yaya_grammar' },
  // -- マニュアル/基本 --
  { path: 'マニュアル/基本/変数',           category: 'yaya_basic' },
  { path: 'マニュアル/基本/関数',           category: 'yaya_basic' },
  { path: 'マニュアル/基本/条件分岐',       category: 'yaya_basic' },
  { path: 'マニュアル/基本/ループ',         category: 'yaya_basic' },
  { path: 'マニュアル/基本/配列',           category: 'yaya_basic' },
  { path: 'マニュアル/基本/演算子',         category: 'yaya_basic' },
  // -- システム辞書 --
  { path: 'システム辞書',                   category: 'yaya_system' },
  { path: 'システム辞書/yaya_shiori3.dic',  category: 'yaya_system' },
  { path: 'システム辞書/yaya_optional.dic', category: 'yaya_system' },
  // -- StartUp --
  { path: 'StartUp',                        category: 'yaya_startup' },
  { path: 'StartUp/YAYAでゴーストを作る',   category: 'yaya_startup' },
  { path: 'StartUp/AYAからの移行',          category: 'yaya_startup' },
  { path: 'StartUp/里々からの移行',         category: 'yaya_startup' },
  // -- SAORI/MAKOTO/PLUGIN --
  { path: 'YAYA as SAORI',                  category: 'yaya_grammar' },
  { path: 'YAYA as MAKOTO',                 category: 'yaya_grammar' },
  { path: 'YAYA as PLUGIN',                 category: 'yaya_grammar' },
];

/** 関数ページのプレフィックス */
export const YAYA_FUNCTION_PAGE_PREFIX = 'マニュアル/関数/';
/** Tipsページのプレフィックス */
export const YAYA_TIPS_PAGE_PREFIX = 'Tips/';

// ============================================================
// HTTP取得
// ============================================================

async function fetchPageHtml(pagePath: string): Promise<string | null> {
  const encodedPath = encodePagePath(pagePath);
  const url = `${BASE_URL}?${encodedPath}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ukagaka-doc-mcp/0.1 (index builder; +https://github.com/)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[yaya-scraper] HTTP ${res.status} for ${url}`);
      return null;
    }

    return await res.text();
  } catch (err) {
    console.error(`[yaya-scraper] Failed to fetch ${url}:`, err);
    return null;
  }
}

function encodePagePath(pagePath: string): string {
  // PukiWikiのURLは各セグメントを%エンコード（/ はそのまま）
  return pagePath.split('/').map(encodeURIComponent).join('/');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// HTMLパース
// ============================================================

/**
 * PukiWiki のHTMLからコンテンツ本文を抽出し、DocEntry を生成する。
 *
 * @param html      取得したHTML
 * @param pagePath  Wikiページパス（canonical_id生成に使用）
 * @param category  カテゴリ
 * @param onePageOneEntry  true の場合はセクション分割せず1エントリにする
 */
export function parseYayaPage(
  html: string,
  pagePath: string,
  category: Category,
  onePageOneEntry = false,
): DocEntry[] {
  const $ = cheerio.load(html);
  const pageUrl = `${BASE_URL}?${encodePagePath(pagePath)}`;

  // ナビゲーション・ヘッダー・フッターを除去
  $('#menu, #menubar, #navi, .navi, #footer, #toolbar, form').remove();
  $('script, style').remove();

  const pageTitle = $('#page-title, h1').first().text().trim() || pagePath.split('/').pop() || pagePath;

  // コンテンツ領域を取得（PukiWiki の #content または body）
  const $content = $('#content, #body, .body').first();
  const $root = $content.length ? $content : $('body');

  if (isInvalidWikiPage(pageTitle, extractText($root.text()))) {
    return [];
  }

  if (onePageOneEntry) {
    // 関数ページ: 1ページ=1エントリ
    const content = extractText($root.text());
    return [{
      id: `yaya:${pagePath}`,
      title: pageTitle,
      source: 'yaya_wiki',
      category,
      content,
      url: pageUrl,
    }];
  }

  // セクション(h2/h3)単位で分割
  const entries: DocEntry[] = [];
  const headers = $root.find('h2, h3');

  if (headers.length === 0) {
    // セクションなし: 1エントリ
    const content = extractText($root.text());
    if (content.trim()) {
      entries.push({
        id: `yaya:${pagePath}`,
        title: pageTitle,
        source: 'yaya_wiki',
        category,
        content,
        url: pageUrl,
      });
    }
    return entries;
  }

  headers.each((_, header) => {
    const $header = $(header);
    const sectionTitle = $header.text().replace(/[†¶#]/g, '').trim();
    if (!sectionTitle) return;

    const anchor = $header.attr('id') || slugify(sectionTitle);

    const parts: string[] = [sectionTitle];
    let $sibling = $header.next();
    while ($sibling.length && !$sibling.is('h2, h3')) {
      const text = $sibling.text().trim();
      if (text) parts.push(text);
      $sibling = $sibling.next();
    }

    const content = parts.join('\n');
    if (content.trim().length < 10) return;

    entries.push({
      id: `yaya:${pagePath}#${anchor}`,
      title: `${pageTitle} - ${sectionTitle}`,
      source: 'yaya_wiki',
      category,
      content,
      url: `${pageUrl}#${anchor}`,
    });
  });

  return entries;
}

// ============================================================
// ページ一覧取得（関数一覧・Tips一覧）
// ============================================================

/**
 * YAYA Wiki の関数一覧ページから個別関数ページのリストを取得する。
 */
export async function fetchYayaFunctionPageList(): Promise<string[]> {
  // マニュアル/関数 の一覧ページを取得してリンクを収集
  const indexPages = ['マニュアル/関数'];
  const functionPages: string[] = [];

  for (const indexPage of indexPages) {
    const html = await fetchPageHtml(indexPage);
    if (!html) continue;

    const $ = cheerio.load(html);
    $('#content a, #body a, .body a').each((_, a) => {
      const href = normalizeYayaWikiHref($(a).attr('href'));
      // ?マニュアル/関数/XXX 形式のリンクを収集
      if (href?.startsWith('?') && !isMetaWikiHref(href) && href.includes('%E3%83%9E%E3%83%8B%E3%83%A5%E3%82%A2%E3%83%AB')) {
        try {
          const pagePath = decodeURIComponent(href.slice(1));
          if (pagePath.startsWith(YAYA_FUNCTION_PAGE_PREFIX) && pagePath !== YAYA_FUNCTION_PAGE_PREFIX) {
            functionPages.push(pagePath);
          }
        } catch {
          // デコード失敗は無視
        }
      }
    });

    await sleep(SCRAPE_RATE_LIMIT_MS);
  }

  return [...new Set(functionPages)]; // 重複除去
}

/**
 * YAYA Wiki の Tips 一覧ページから個別Tipsページのリストを取得する。
 */
export async function fetchYayaTipsPageList(): Promise<string[]> {
  const tipsPages: string[] = [];
  const html = await fetchPageHtml('Tips');
  if (!html) return tipsPages;

  const $ = cheerio.load(html);
  $('#content a, #body a').each((_, a) => {
    const href = normalizeYayaWikiHref($(a).attr('href'));
    if (href?.startsWith('?') && !isMetaWikiHref(href)) {
      try {
        const pagePath = decodeURIComponent(href.slice(1));
        if (pagePath.startsWith(YAYA_TIPS_PAGE_PREFIX)) {
          tipsPages.push(pagePath);
        }
      } catch {
        // ignore
      }
    }
  });

  await sleep(SCRAPE_RATE_LIMIT_MS);
  return [...new Set(tipsPages)];
}

// ============================================================
// メインスクレイプ関数
// ============================================================

/**
 * YAYA Wiki全体をスクレイプして DocEntry[] を返す。
 */
export async function scrapeYayaWiki(): Promise<DocEntry[]> {
  const allEntries: DocEntry[] = [];

  // 1. 静的ページ
  console.error('[yaya-scraper] Scraping static pages...');
  for (const pageDef of YAYA_STATIC_PAGES) {
    const html = await fetchPageHtml(pageDef.path);
    if (html) {
      const entries = parseYayaPage(html, pageDef.path, pageDef.category, pageDef.onePageOneEntry);
      allEntries.push(...entries);
      console.error(`[yaya-scraper] ${pageDef.path}: ${entries.length} entries`);
    }
    await sleep(SCRAPE_RATE_LIMIT_MS);
  }

  // 2. 関数ページ（動的に一覧を取得）
  console.error('[yaya-scraper] Fetching function page list...');
  const functionPages = await fetchYayaFunctionPageList();
  console.error(`[yaya-scraper] Found ${functionPages.length} function pages`);

  for (const pagePath of functionPages) {
    const html = await fetchPageHtml(pagePath);
    if (html) {
      // 関数ページは1ページ=1エントリ
      const entries = parseYayaPage(html, pagePath, 'yaya_function', true);
      allEntries.push(...entries);
    }
    await sleep(SCRAPE_RATE_LIMIT_MS);
  }

  // 3. Tips ページ（動的に一覧を取得）
  console.error('[yaya-scraper] Fetching Tips page list...');
  const tipsPages = await fetchYayaTipsPageList();
  console.error(`[yaya-scraper] Found ${tipsPages.length} Tips pages`);

  for (const pagePath of tipsPages) {
    const html = await fetchPageHtml(pagePath);
    if (html) {
      const entries = parseYayaPage(html, pagePath, 'yaya_tips');
      allEntries.push(...entries);
    }
    await sleep(SCRAPE_RATE_LIMIT_MS);
  }

  console.error(`[yaya-scraper] Total: ${allEntries.length} entries`);
  return allEntries;
}

// ============================================================
// ユーティリティ
// ============================================================

function extractText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function slugify(text: string): string {
  return text
    .replace(/[^\w\u3040-\u9FFF]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64);
}

export function normalizeYayaWikiHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  }

  if (href.startsWith('#')) {
    return null;
  }

  let normalized = href;

  if (normalized.startsWith('./?')) {
    normalized = normalized.slice(2);
  }

  if (!normalized.startsWith('?')) {
    return null;
  }

  return normalized.split('#', 1)[0] || null;
}

function isMetaWikiHref(href: string): boolean {
  return href.startsWith('?cmd=') || href.startsWith('?plugin=');
}

function isInvalidWikiPage(pageTitle: string, bodyText: string): boolean {
  return INVALID_PAGE_MARKERS.some(marker =>
    pageTitle.includes(marker) || bodyText.includes(marker),
  );
}
