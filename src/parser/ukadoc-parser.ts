/**
 * UKADOCパーサー
 *
 * UKADOC の HTMLファイルを解析して DocEntry 配列を返す。
 *
 * HTML構造の観察:
 * - list_sakura_script.html: section.category > dl > dt.entry が各タグ
 * - list_shiori_event.html: section.category > dl > dt.entry が各イベント
 * - descript_*.html: section > dl > dt.entry or セクション形式
 * - spec_*.html: セクション形式（h2/h3 + 説明文）
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { DocEntry, Category } from '../types.js';
import { truncateContent } from '../text.js';

// ============================================================
// ファイル → カテゴリ のマッピング
// ============================================================

/** filename (拡張子なし) → Category */
const FILE_CATEGORY_MAP: Record<string, Category> = {
  list_sakura_script:        'sakurascript',
  list_shiori_event:         'shiori_event',
  list_shiori_event_ex:      'shiori_event',
  list_shiori_resource:      'shiori_event',
  list_plugin_event:         'shiori_event',
  list_propertysystem:       'protocol',
  descript_ghost:            'descript',
  descript_shell:            'descript',
  descript_shell_surfaces:   'descript',
  descript_shell_surfacetable: 'descript',
  descript_balloon:          'descript',
  descript_install:          'descript',
  descript_headline:         'descript',
  descript_plugin:           'descript',
  spec_shiori3:              'protocol',
  spec_sstp:                 'protocol',
  spec_dll:                  'protocol',
  spec_plugin:               'protocol',
  spec_fmo_mutex:            'protocol',
  spec_headline:             'protocol',
  spec_update_file:          'protocol',
  spec_web:                  'protocol',
  manual_directory:          'file_structure',
  manual_ghost:              'file_structure',
  manual_shell:              'file_structure',
  manual_balloon:            'file_structure',
  manual_install:            'file_structure',
  manual_update:             'file_structure',
  manual_translator:         'file_structure',
  manual_owner_draw_menu:    'file_structure',
  dev_bind:                  'dev_guide',
  dev_nar:                   'dev_guide',
  dev_ownerdraw:             'dev_guide',
  dev_shell:                 'dev_guide',
  dev_shell_error:           'dev_guide',
  dev_update:                'dev_guide',
  memo:                      'dev_guide',
  memo_shiorievent:          'shiori_event',
};

// ============================================================
// パース関数
// ============================================================

/**
 * UKADOC の manual/ ディレクトリ全体をパースして DocEntry[] を返す。
 */
export function parseUkadocManual(manualDir: string): DocEntry[] {
  if (!existsSync(manualDir)) {
    throw new Error(`UKADOC manual directory not found: ${manualDir}\nRun: git submodule update --init --recursive`);
  }

  const htmlFiles = readdirSync(manualDir)
    .filter(f => f.endsWith('.html') && !f.startsWith('index') && f !== 'base.css');

  const entries: DocEntry[] = [];

  for (const filename of htmlFiles) {
    const stem = basename(filename, '.html');
    const category = FILE_CATEGORY_MAP[stem];
    if (!category) {
      // マッピングにないファイルはスキップ
      continue;
    }

    const filePath = join(manualDir, filename);
    const html = readFileSync(filePath, 'utf-8');
    const fileEntries = parseUkadocFile(html, filename, category);
    entries.push(...fileEntries);
  }

  return entries;
}

/**
 * 単一のUKADOC HTMLファイルをパースして DocEntry[] を返す。
 */
export function parseUkadocFile(
  html: string,
  filename: string,
  category: Category,
): DocEntry[] {
  const $ = cheerio.load(html);
  const stem = basename(filename, '.html');
  const baseUrl = `https://ssp.shillest.net/ukadoc/manual/${filename}`;

  // まずナビゲーションを除去
  $('nav').remove();
  $('.navigation-bar').remove();
  $('header').remove();

  const pageTitle = $('h1#page-title').text().trim() || $('title').text().trim() || stem;

  const entries: DocEntry[] = [];

  // --------------------------------------------------------
  // パターン1: dt.entry を持つ定義リスト形式
  // (list_sakura_script, list_shiori_event, descript_* 等)
  // --------------------------------------------------------
  const dtEntries = $('dt.entry');
  if (dtEntries.length > 0) {
    dtEntries.each((_, dt) => {
      const $dt = $(dt);
      const entryName = $dt.text().trim();
      if (!entryName) return;

      // id 属性または前のアンカーから anchor を取得
      const anchor = $dt.attr('id') || $dt.prev('a').attr('name') || slugify(entryName);

      // dd (説明) を取得
      const $dd = $dt.next('dd');
      const description = $dd.text().trim();

      // セクション見出しを取得（親の section 内の最初の caption/h2 等）
      const sectionTitle = getSectionTitle($, $dt);

      const content = [
        sectionTitle ? `[${sectionTitle}]` : '',
        entryName,
        description,
      ].filter(Boolean).join('\n');

      entries.push({
        id: `ukadoc:${stem}:${anchor}`,
        title: entryName,
        source: 'ukadoc',
        category,
        content: truncateContent(content),
        url: `${baseUrl}#${anchor}`,
      });
    });

    return entries;
  }

  // --------------------------------------------------------
  // パターン2: セクション形式 (spec_*, manual_*, dev_*)
  // h2 または h3 でセクション分割
  // --------------------------------------------------------
  const sectionHeaders = $('h2, h3');
  if (sectionHeaders.length > 0) {
    sectionHeaders.each((_, header) => {
      const $header = $(header);
      const sectionTitle = $header.text().trim();
      if (!sectionTitle) return;

      const anchor = $header.attr('id') || slugify(sectionTitle);

      // セクションの本文: 次のh2/h3が来るまでのテキストを集める
      const contentParts: string[] = [sectionTitle];
      let $next = $header.next();
      while ($next.length && !$next.is('h2, h3')) {
        const text = $next.text().trim();
        if (text) contentParts.push(text);
        $next = $next.next();
      }

      const content = contentParts.join('\n');
      if (content.length <= sectionTitle.length + 5) return; // 本文がほぼ空ならスキップ

      entries.push({
        id: `ukadoc:${stem}:${anchor}`,
        title: `${pageTitle} - ${sectionTitle}`,
        source: 'ukadoc',
        category,
        content: truncateContent(content),
        url: `${baseUrl}#${anchor}`,
      });
    });

    if (entries.length > 0) return entries;
  }

  // --------------------------------------------------------
  // パターン3: フォールバック - ページ全体を1エントリとして扱う
  // --------------------------------------------------------
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  entries.push({
    id: `ukadoc:${stem}`,
    title: pageTitle,
    source: 'ukadoc',
    category,
    content: truncateContent(bodyText),
    url: baseUrl,
  });

  return entries;
}

// ============================================================
// ユーティリティ
// ============================================================

function getSectionTitle($: cheerio.CheerioAPI, $el: cheerio.Cheerio<Element>): string {
  // 親の section 内の caption または h2 を探す
  const $section = $el.closest('section.category');
  if ($section.length) {
    const caption = $section.prev('section.caption').find('h2').first().text().trim();
    if (caption) return caption;
    const h2 = $section.find('h2').first().text().trim();
    if (h2) return h2;
  }
  return '';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\\\/\[\]]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^\w\u3040-\u9FFF]/g, '')
    .slice(0, 64);
}
