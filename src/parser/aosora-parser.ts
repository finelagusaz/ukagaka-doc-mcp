/**
 * 蒼空 (aosora-shiori) GitHub Wiki パーサー
 *
 * docs/aosora-wiki/manual/*.md（git submodule）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。
 *
 * 設計方針:
 * - 1ページ = 1エントリ（情報断片化防止。全42ページ・計約100KBと小ぶり）
 * - 目次ページ（00_ プレフィックス）は除外
 * - Markdown → プレーンテキスト化はコード範囲を保護してから記号を除去
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Category, DocEntry } from '../types.js';

/**
 * Markdown をプレーンテキストに変換する。
 * fenced code / inline code の中身は無加工で保持する。
 */
export function markdownToPlainText(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let fenceMarker: '```' | '~~~' | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      const marker = fenceMatch[1] as '```' | '~~~';
      if (fenceMarker === null) {
        fenceMarker = marker; // フェンス開始行は出力しない
      } else if (fenceMarker === marker) {
        fenceMarker = null; // フェンス終了行も出力しない
      } else {
        out.push(line); // フェンス内の別種マーカーはコードとして保持
      }
      continue;
    }

    if (fenceMarker !== null) {
      out.push(line); // コードフェンス内は無加工
      continue;
    }

    out.push(stripInlineMarkdown(line));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 1行分の inline Markdown 記法を除去する。inline code の中身は保護する。 */
function stripInlineMarkdown(line: string): string {
  // inline code を NUL 区切りプレースホルダに退避
  const codeSpans: string[] = [];
  let text = line.replace(/`([^`]*)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  text = text
    .replace(/^#{1,6}\s+/, '')                    // 見出し記号
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')     // 画像 → alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // リンク → テキスト
    .replace(/(\*\*|__)(.+?)\1/g, '$2')           // 強い強調
    .replace(/(\*|_)([^\s*_][^*_]*)\1/g, '$2');   // 強調

  // 退避した inline code を復元
  return text.replace(/\u0000(\d+)\u0000/g, (_match, i: string) => codeSpans[Number(i)]);
}

const AOSORA_WIKI_BASE_URL = 'https://github.com/kanadelab/aosora-shiori/wiki/';

/**
 * manual ディレクトリ内の Markdown を全てパースして DocEntry 配列を返す。
 * 目次ページ（00_ プレフィックス）と空ページは除外する。
 */
export function parseAosoraWiki(manualDir: string): DocEntry[] {
  const files = readdirSync(manualDir)
    .filter(file => file.endsWith('.md'))
    .sort();

  const entries: DocEntry[] = [];

  for (const file of files) {
    const stem = file.replace(/\.md$/, '');
    if (/^00_/.test(stem)) continue; // 目次ページは検索ノイズのため除外

    const raw = readFileSync(join(manualDir, file), 'utf-8');
    const content = markdownToPlainText(raw);
    if (!content) continue;

    entries.push({
      id: `aosora:${stem}`,
      title: extractTitle(raw, stem),
      source: 'aosora_wiki',
      category: categoryForStem(stem),
      content,
      url: `${AOSORA_WIKI_BASE_URL}${encodeURIComponent(stem)}`,
    });
  }

  return entries;
}

/** 先頭 h1 見出し。無ければファイル名から番号プレフィックスを除いて整形。 */
function extractTitle(markdown: string, stem: string): string {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return stem.replace(/^\d{2}(_\d{2})?_/, '').replace(/_/g, ' ');
}

/**
 * ファイル名の第1階層番号（/^(\d{2})_/）からカテゴリを割当する。
 * - 03〜06: aosora_grammar（スクリプト・関数・トーク・データ型）
 * - 07, 13: aosora_builtin（組み込み機能・stdユニット）
 * - 12: aosora_advanced（ユニット・クラス・例外）
 * - その他既知（01,02,08〜11,14〜16）: aosora_general
 * - 形式不一致・未知番号: 警告を出して aosora_general（Wiki構成変更の検知手段）
 */
function categoryForStem(stem: string): Category {
  const match = stem.match(/^(\d{2})_/);
  if (!match) {
    console.error(`[aosora-parser] Warning: unexpected filename format, falling back to aosora_general: ${stem}`);
    return 'aosora_general';
  }

  const chapter = Number(match[1]);
  if (chapter >= 3 && chapter <= 6) return 'aosora_grammar';
  if (chapter === 7 || chapter === 13) return 'aosora_builtin';
  if (chapter === 12) return 'aosora_advanced';
  if ((chapter >= 1 && chapter <= 2) || (chapter >= 8 && chapter <= 11) || (chapter >= 14 && chapter <= 16)) {
    return 'aosora_general';
  }

  console.error(`[aosora-parser] Warning: unknown chapter ${match[1]}, falling back to aosora_general: ${stem}`);
  return 'aosora_general';
}
