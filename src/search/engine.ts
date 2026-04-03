/**
 * 検索エンジン
 *
 * インメモリ全文検索。起動時に DocEntry[] をロードして以後はメモリ内で検索する。
 *
 * 検索仕様:
 * - 大文字小文字無視
 * - 日本語・英語とも部分一致
 * - バックスラッシュ正規化: \\s → \s（クエリとコンテンツ両方に適用）
 * - スコアリング: タイトル完全一致 > タイトル部分一致 > 本文部分一致
 */

import type { DocEntry, SearchEntry, Source, Category } from '../types.js';
import { buildSummary } from '../text.js';

// ============================================================
// 正規化
// ============================================================

function normalizeQuery(query: string): string {
  return query
    // \\s → \s のような二重バックスラッシュを正規化
    .replace(/\\\\/g, '\\')
    .toLowerCase();
}

function normalizeContent(text: string): string {
  return text
    .replace(/\\\\/g, '\\')
    .toLowerCase();
}

// ============================================================
// スコアリング
// ============================================================

const SCORE_TITLE_EXACT    = 100;
const SCORE_TITLE_PARTIAL  = 50;
const SCORE_CONTENT_MATCH  = 10;

function scoreEntry(entry: DocEntry, normalizedQuery: string): number {
  const title = normalizeContent(entry.title);
  const content = normalizeContent(entry.content);

  if (title === normalizedQuery) return SCORE_TITLE_EXACT;
  if (title.includes(normalizedQuery)) return SCORE_TITLE_PARTIAL;
  if (content.includes(normalizedQuery)) return SCORE_CONTENT_MATCH;
  return 0;
}

// ============================================================
// 検索エンジンクラス
// ============================================================

export interface SearchOptions {
  category?: Category;
  source?: Source;
  limit?: number;
}

export class SearchEngine {
  private entries: DocEntry[] = [];

  /**
   * インデックスをロードする。起動時に1回呼ぶ。
   */
  load(entries: DocEntry[]): void {
    this.entries = entries;
    console.error(`[search-engine] Loaded ${entries.length} entries`);
  }

  /**
   * インデックスにエントリをマージする（差分更新用。将来の拡張のため残す）。
   */
  merge(newEntries: DocEntry[]): void {
    const idSet = new Set(newEntries.map(e => e.id));
    this.entries = [
      ...this.entries.filter(e => !idSet.has(e.id)),
      ...newEntries,
    ];
  }

  get size(): number {
    return this.entries.length;
  }

  /**
   * id でエントリを1件取得する（get_doc ツール用）。
   */
  getById(id: string): DocEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  /**
   * キーワード検索。SearchEntry（summary付き）のリストを返す。
   */
  search(query: string, opts: SearchOptions = {}): { results: SearchEntry[]; total: number } {
    if (!query.trim()) {
      return { results: [], total: 0 };
    }

    const normalizedQuery = normalizeQuery(query);
    const limit = Math.min(opts.limit ?? 10, 50);

    const scored: Array<{ entry: DocEntry; score: number }> = [];

    for (const entry of this.entries) {
      // ソースフィルタ
      if (opts.source && entry.source !== opts.source) continue;
      // カテゴリフィルタ
      if (opts.category && entry.category !== opts.category) continue;

      const score = scoreEntry(entry, normalizedQuery);
      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    // スコア降順 → id昇順（同スコア内の安定ソート）
    scored.sort((a, b) =>
      b.score - a.score || a.entry.id.localeCompare(b.entry.id),
    );

    const total = scored.length;
    const results = scored.slice(0, limit).map(({ entry }) => toSearchEntry(entry));

    return { results, total };
  }
}

// ============================================================
// DocEntry → SearchEntry 変換
// ============================================================

function toSearchEntry(entry: DocEntry): SearchEntry {
  return {
    id: entry.id,
    title: entry.title,
    source: entry.source,
    category: entry.category,
    summary: buildSummary(entry.content),
    url: entry.url,
  };
}
