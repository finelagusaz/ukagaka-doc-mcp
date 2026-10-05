/**
 * SSP ヘルプパーサー
 *
 * docs/ukadoc/ssphelp_src/*.html（git submodule: ukatech/ukadoc）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。
 *
 * 設計方針:
 * - 生成済みの ssphelp/ は更新が止まっているため、公開サイトの元になる ssphelp_src/ を読む
 * - 1ページ = 1エントリ（yaya-docs / satori-docs と同じ）
 * - 対象ページとカテゴリは上流サイトの目次 ssphelp_builder/index.yaml から決める。
 *   目次に無い原稿（中身の空な disclaimer.html 等）は取り込まない
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { Category, DocEntry } from '../types.js';

const SSPHELP_BASE_URL = 'https://ssp.shillest.net/ukadoc/ssphelp/';

/** 目次の最上位項目 → カテゴリ */
const SECTION_CATEGORIES: Record<string, Category> = {
  'はじめに': 'ssp_usage',
  '基本的な使い方': 'ssp_usage',
  '機能': 'ssp_feature',
  '設定': 'ssp_config',
  '情報': 'ssp_info',
  'リンク集': 'ssp_info',
  'よくある質問': 'ssp_info',
  '用語説明': 'ssp_info',
  'SSPの基本情報': 'ssp_info',
  '開発者向けヘルプ': 'ssp_dev',
};

/** 改行を入れるブロック要素 */
const BLOCK_SELECTOR = 'p, div, h1, h2, h3, h4, h5, h6, li, dt, dd, table, ul, ol, dl, pre, blockquote, section';

/** pre を退避した位置の目印。原稿に現れない私用領域の文字で番号を挟む */
const PRE_PLACEHOLDER = '';
const PRE_PATTERN = new RegExp(`${PRE_PLACEHOLDER}(\\d+)${PRE_PLACEHOLDER}`, 'g');

interface TocPage {
  place: string;
  section: string;
}

/**
 * ukadoc リポジトリの SSP ヘルプ原稿を全てパースして DocEntry 配列を返す。
 * 目次の未知の最上位項目と、目次に無い原稿は警告を出してスキップする（上流の構成変更の検知手段）。
 */
export function parseSspHelp(ukadocDir: string): DocEntry[] {
  const srcDir = join(ukadocDir, 'ssphelp_src');
  const tocPath = join(ukadocDir, 'ssphelp_builder', 'index.yaml');
  if (!existsSync(srcDir) || !existsSync(tocPath)) {
    throw new Error(`SSP help source not found: ${srcDir}\nRun: git submodule update --init --recursive`);
  }

  const toc = parseToc(readFileSync(tocPath, 'utf-8'));
  const listed = new Set(toc.map(page => page.place));

  for (const file of readdirSync(srcDir).filter(file => file.endsWith('.html')).sort()) {
    const place = file.replace(/\.html$/, '');
    if (!listed.has(place) && readFileSync(join(srcDir, file), 'utf-8').trim()) {
      console.error(`[ssphelp-parser] Warning: page not in index.yaml, skipped: ${place}`);
    }
  }

  const entries: DocEntry[] = [];

  for (const { place, section } of toc) {
    // 継承プロパティ（constructor 等）に当たらないよう自身のキーだけを引く
    const category = Object.hasOwn(SECTION_CATEGORIES, section) ? SECTION_CATEGORIES[section] : undefined;
    if (!category) {
      console.error(`[ssphelp-parser] Warning: unknown section in index.yaml, skipped: ${section} (${place})`);
      continue;
    }

    const filePath = join(srcDir, `${place}.html`);
    if (!existsSync(filePath)) {
      console.error(`[ssphelp-parser] Warning: page listed in index.yaml not found: ${place}`);
      continue;
    }

    const { title, content } = parseSspHelpHtml(readFileSync(filePath, 'utf-8'), place);
    if (!content) continue;

    entries.push({
      id: `ssphelp:${place}`,
      title,
      source: 'ssp_help',
      category,
      content,
      url: `${SSPHELP_BASE_URL}${encodeURIComponent(place)}.html`,
    });
  }

  return entries;
}

/**
 * index.yaml（title / place / children だけの入れ子リスト）から、ページと最上位項目の対応を読む。
 * 行頭の `- title:` が最上位項目で、その下の `place:` はすべてその項目に属する。
 */
export function parseToc(yaml: string): TocPage[] {
  const pages: TocPage[] = [];
  let section = '';

  for (const line of yaml.split(/\r?\n/)) {
    const top = line.match(/^- title:\s*(.+?)\s*$/);
    if (top) {
      section = top[1];
      continue;
    }
    const place = line.match(/^\s*(?:- )?place:\s*(\S+)\s*$/);
    if (place && section) {
      pages.push({ place: place[1], section });
    }
  }

  return pages;
}

/** 原稿 HTML 断片から title（先頭 h1、無ければ place）とプレーンテキスト本文を取り出す。 */
export function parseSspHelpHtml(html: string, place: string): { title: string; content: string } {
  const $ = cheerio.load(html, null, false);
  $('script, style').remove();

  const title = $('h1').first().text().replace(/\s+/g, ' ').trim() || place;

  // pre は改行・字下げに意味があるので、空白の正規化が済むまで退避しておく
  const preTexts: string[] = [];
  $('pre').each((_, pre) => {
    preTexts.push($(pre).text().replace(/^\r?\n/, '').replace(/\s+$/, ''));
    $(pre).replaceWith(`<p>${PRE_PLACEHOLDER}${preTexts.length - 1}${PRE_PLACEHOLDER}</p>`);
  });

  // ソース上の改行・字下げは HTML では意味を持たないので、先に空白へ潰す
  $('*').contents().each((_, node) => {
    if (node.type === 'text') node.data = node.data.replace(/\s+/g, ' ');
  });

  // 表のセル内の改行は行を割らないよう空白にする（詰めると英単語どうしが繋がる）
  $('td br, th br').replaceWith(' ');
  $('td, th').find(BLOCK_SELECTOR).each((_, el) => {
    $(el).prepend(' ').append(' ');
  });

  // 表の行はセルを | で区切った 1 行にする（行の間に空行を挟まない）
  $('tr').each((_, tr) => {
    const cells = $(tr).children('th, td').map((_, cell) => $(cell).text().trim()).get();
    $(tr).text(`| ${cells.join(' | ')} |`).append('\n');
  });

  $('br').replaceWith('\n');
  $(BLOCK_SELECTOR).each((_, el) => {
    $(el).prepend('\n').append('\n');
  });

  const content = $.root().text()
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(PRE_PATTERN, (_, index: string) => preTexts[Number(index)]);

  return { title, content };
}
