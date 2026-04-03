/**
 * 里々Wiki スクレイパー
 *
 * https://soliton.sub.jp/satori/ (PukiWiki 1.5.4)
 *
 * 里々Wikiのコンテンツ構造:
 * - 資料系: 特殊記号一覧, 演算子一覧, 変数, 情報取得変数, 特殊変数, 関数一覧, ファイル構成
 * - 独自イベント
 * - TIPS: TIPS総合, ゴースト作りのTIPSまとめ, 困ったときの対処法 + 個別TIPSページ
 * - 里々について: 里々の内部処理, 栞としての里々
 * - SAORI: SAORI, SAORI/里々
 */

import { SCRAPE_RATE_LIMIT_MS } from '../constants.js';
import type { DocEntry, Category } from '../types.js';
import * as cheerio from 'cheerio';
import { truncateContent } from '../text.js';

const BASE_URL = 'https://soliton.sub.jp/satori/';

// ============================================================
// スクレイプ対象ページ定義
// ============================================================

interface SatoriPageDef {
  /** Wiki ページ名 (?ページ名 の形式) */
  pageName: string;
  category: Category;
}

/** 静的スクレイプ対象ページ */
export const SATORI_STATIC_PAGES: SatoriPageDef[] = [
  // 資料
  { pageName: '特殊記号一覧',    category: 'satori_reference' },
  { pageName: '演算子一覧',      category: 'satori_reference' },
  { pageName: '変数',            category: 'satori_reference' },
  { pageName: '情報取得変数',    category: 'satori_reference' },
  { pageName: '特殊変数',        category: 'satori_reference' },
  { pageName: '関数',            category: 'satori_reference' },
  { pageName: '関数一覧',        category: 'satori_reference' },
  { pageName: 'ファイル構成',    category: 'satori_reference' },
  // 独自イベント
  { pageName: '独自イベント',    category: 'satori_event' },
  // TIPS
  { pageName: 'TIPS総合',        category: 'satori_tips' },
  { pageName: 'ゴースト作りのTIPSまとめ', category: 'satori_tips' },
  { pageName: '困ったときの対処法',       category: 'satori_tips' },
  // 里々について
  { pageName: '里々の内部処理',  category: 'satori_reference' },
  { pageName: '栞としての里々',  category: 'satori_reference' },
  // SAORI
  { pageName: 'SAORI',           category: 'satori_saori' },
  { pageName: 'SAORI/里々',      category: 'satori_saori' },
];

// ============================================================
// HTTP取得
// ============================================================

async function fetchPageHtml(pageName: string): Promise<string | null> {
  const url = `${BASE_URL}?${encodeURIComponent(pageName)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ukagaka-doc-mcp/0.1 (index builder)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[satori-scraper] HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`[satori-scraper] Failed to fetch ${url}:`, err);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// HTMLパース
// ============================================================

/**
 * 里々WikiページのHTMLをパースして DocEntry[] を返す。
 */
export function parseSatoriPage(
  html: string,
  pageName: string,
  category: Category,
): DocEntry[] {
  const $ = cheerio.load(html);
  const pageUrl = `${BASE_URL}?${encodeURIComponent(pageName)}`;

  // メタ要素・ナビゲーション除去
  $('script, style').remove();
  // PukiWiki のナビゲーション部分除去
  // (#navi, .navi, #menubar, .menubar, #toolbar, .toolbar)
  $('#navi, .navi, #menubar, .menubar, #toolbar, .toolbar').remove();
  // フッター除去 (#lastmodified, #footer, .footer)
  $('#lastmodified, #footer, .footer').remove();
  // 編集リンク除去
  $('a[href*="cmd=edit"], a[href*="cmd=freeze"]').remove();

  const pageTitle = $('h1').first().text().trim() ||
    $('#page-title').text().trim() ||
    pageName;

  // PukiWiki のコンテンツ領域
  const $content = $('#content, #body, .body, .wiki').first();
  const $root = $content.length ? $content : $('body');

  const entries: DocEntry[] = [];
  const headers = $root.find('h2, h3');

  if (headers.length === 0) {
    // セクションなし: ページ全体を1エントリ
    const content = $root.text().replace(/\s+/g, ' ').trim();
    if (content.length > 20) {
      entries.push({
        id: `satori:${pageName}`,
        title: pageTitle,
        source: 'satori_wiki',
        category,
        content: truncateContent(content),
        url: pageUrl,
      });
    }
    return entries;
  }

  // セクション単位で分割
  headers.each((_, header) => {
    const $header = $(header);
    // PukiWiki の見出し末尾 † を除去
    const sectionTitle = $header.text().replace(/†/g, '').trim();
    if (!sectionTitle || sectionTitle.length < 2) return;

    const anchor = $header.find('a[id], a[name]').attr('id') ||
      $header.find('a[id], a[name]').attr('name') ||
      slugify(sectionTitle);

    const parts: string[] = [sectionTitle];
    let $sibling = $header.next();
    while ($sibling.length && !$sibling.is('h2, h3')) {
      const text = $sibling.text().trim();
      if (text) parts.push(text);
      $sibling = $sibling.next();
    }

    const content = parts.join('\n');
    if (content.trim().length < 5) return;

    entries.push({
      id: `satori:${pageName}#${anchor}`,
      title: `${pageTitle} - ${sectionTitle}`,
      source: 'satori_wiki',
      category,
      content: truncateContent(content),
      url: `${pageUrl}#${anchor}`,
    });
  });

  // セクションが取れなかった場合はページ全体
  if (entries.length === 0) {
    const content = $root.text().replace(/\s+/g, ' ').trim();
    if (content.length > 20) {
      entries.push({
        id: `satori:${pageName}`,
        title: pageTitle,
        source: 'satori_wiki',
        category,
        content: truncateContent(content),
        url: pageUrl,
      });
    }
  }

  return entries;
}

// ============================================================
// 動的ページ一覧取得（個別Tipsページ）
// ============================================================

/**
 * TIPS総合ページからリンクされている個別Tipsページを収集する。
 */
export async function fetchSatoriTipsPageList(): Promise<string[]> {
  const tipsPages: string[] = [];
  const html = await fetchPageHtml('TIPS総合');
  if (!html) return tipsPages;

  const $ = cheerio.load(html);
  $('a[href]').each((_, a) => {
    const href = normalizeWikiHref($(a).attr('href'));
    try {
      if (!href?.startsWith('?')) {
        return;
      }

      const pageName = decodeURIComponent(href.slice(1));
      // TIPS一覧・注意書き等のメタページを除外
      if (
        pageName &&
        pageName !== 'TIPS総合' &&
        pageName !== 'RecentChanges' &&
        !pageName.startsWith('cmd=') &&
        !pageName.startsWith('plugin=') &&
        pageName.length > 1
      ) {
        tipsPages.push(pageName);
      }
    } catch {
      // ignore
    }
  });

  await sleep(SCRAPE_RATE_LIMIT_MS);
  return [...new Set(tipsPages)];
}

// ============================================================
// メインスクレイプ関数
// ============================================================

/**
 * 里々Wiki全体をスクレイプして DocEntry[] を返す。
 */
export async function scrapeSatoriWiki(): Promise<DocEntry[]> {
  const allEntries: DocEntry[] = [];

  // 1. 静的ページ
  console.error('[satori-scraper] Scraping static pages...');
  for (const pageDef of SATORI_STATIC_PAGES) {
    const html = await fetchPageHtml(pageDef.pageName);
    if (html) {
      const entries = parseSatoriPage(html, pageDef.pageName, pageDef.category);
      allEntries.push(...entries);
      console.error(`[satori-scraper] ${pageDef.pageName}: ${entries.length} entries`);
    }
    await sleep(SCRAPE_RATE_LIMIT_MS);
  }

  // 2. 個別Tipsページ（動的に一覧を取得）
  console.error('[satori-scraper] Fetching Tips page list...');
  const tipsPages = await fetchSatoriTipsPageList();
  console.error(`[satori-scraper] Found ${tipsPages.length} Tips pages`);

  for (const pageName of tipsPages) {
    // すでにスクレイプ済みのページはスキップ
    if (SATORI_STATIC_PAGES.some(p => p.pageName === pageName)) continue;

    const html = await fetchPageHtml(pageName);
    if (html) {
      const entries = parseSatoriPage(html, pageName, 'satori_tips');
      allEntries.push(...entries);
    }
    await sleep(SCRAPE_RATE_LIMIT_MS);
  }

  console.error(`[satori-scraper] Total: ${allEntries.length} entries`);
  return allEntries;
}

// ============================================================
// ユーティリティ
// ============================================================

function slugify(text: string): string {
  return text
    .replace(/[^\w\u3040-\u9FFF]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64);
}

function normalizeWikiHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  }

  if (href.startsWith('./?')) {
    return href.slice(2);
  }

  return href;
}
