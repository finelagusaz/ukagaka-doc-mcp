// ============================================================
// 共通型定義
// ============================================================

import type { CATEGORIES, SOURCE_VALUES } from './constants.js';

// ソース種別（constants.ts の SOURCES から派生）
export type Source = (typeof SOURCE_VALUES)[number];

// カテゴリID（CATEGORIES定数のキー）
export type Category = keyof typeof CATEGORIES;

// ============================================================
// インデックスエントリ（data/index.json に保存）
// ============================================================

/**
 * ドキュメントエントリ（全文を含む）。
 * index.json に保存される形式。
 */
export interface DocEntry {
  /** canonical_id（形式はソースごとに異なる。各ソースの例は constants.ts の SOURCES[*].exampleId）
   * - ukadoc: `ukadoc:{filename}:{section_anchor}`
   * - Markdown 由来のソース: `{接頭辞}:{ファイルパス stem}`（pasta_docs の節は末尾に `:{## 見出しのアンカー}`）
   */
  id: string;
  title: string;
  source: Source;
  category: Category;
  /** 本文全文（truncationなし） */
  content: string;
  /** 元ページURL */
  url: string;
  /** 元ページの生 Markdown の URL（Markdown が元のソース: yaya_docs / satori_docs / aosora_wiki / minato_docs / pasta_docs のみ） */
  rawUrl?: string;
}

/**
 * 検索結果エントリ（search_docs が返す形式）。
 * content の先頭500文字を summary として返すことでトークン消費を抑える。
 */
export interface SearchEntry {
  id: string;
  title: string;
  source: Source;
  category: Category;
  /** content 先頭500文字 */
  summary: string;
  url: string;
  rawUrl?: string;
}

// ============================================================
// インデックスファイル
// ============================================================

export interface IndexFile {
  /** スキーマバージョン。互換性チェック用 */
  version: number;
  /** ビルド日時 (ISO 8601) */
  generatedAt: string;
  entries: DocEntry[];
}

// ============================================================
// MCP ツール レスポンス型
// ============================================================

export interface SearchResult {
  status: 'ok' | 'not_found' | 'error';
  data?: SearchEntry[];
  total?: number;
  message?: string;
}

export interface GetDocResult {
  status: 'ok' | 'not_found' | 'error';
  data?: DocEntry;
  message?: string;
}

export interface CategoryInfo {
  id: Category;
  source: Source;
  label: string;
}
