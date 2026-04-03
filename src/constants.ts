// ============================================================
// 定数定義（単一ソース）
// ============================================================

import type { Source } from './types.js';

/** インデックスが stale とみなされるまでの日数 */
export const STALE_AFTER_DAYS = 7;

/** インデックスファイルの現在のスキーマバージョン */
export const INDEX_SCHEMA_VERSION = 1;

/** search_docs で返す summary の最大文字数 */
export const SUMMARY_MAX_LENGTH = 500;

/** ビルド時スクレイプのレート制限 (ms) */
export const SCRAPE_RATE_LIMIT_MS = 500;

// ============================================================
// カテゴリ定義
// ソースとカテゴリIDの対応を一元管理。
// パーサー・ツール・テスト全てがここから参照する。
// ============================================================

export const CATEGORIES = {
  // --- UKADOC ---
  sakurascript: {
    source: 'ukadoc' as Source,
    label: 'さくらスクリプト命令',
  },
  shiori_event: {
    source: 'ukadoc' as Source,
    label: 'SHIORIイベント一覧',
  },
  descript: {
    source: 'ukadoc' as Source,
    label: '設定ファイル仕様（descript.txt / surfaces.txt 等）',
  },
  protocol: {
    source: 'ukadoc' as Source,
    label: 'プロトコル仕様（SHIORI/3.0, SSTP 等）',
  },
  file_structure: {
    source: 'ukadoc' as Source,
    label: 'ファイル構成・ディレクトリ構造',
  },
  dev_guide: {
    source: 'ukadoc' as Source,
    label: '開発ガイド（シェル作成, NAR作成 等）',
  },

  // --- YAYA Wiki ---
  yaya_grammar: {
    source: 'yaya_wiki' as Source,
    label: 'YAYA言語文法',
  },
  yaya_basic: {
    source: 'yaya_wiki' as Source,
    label: 'YAYA基礎概念（変数・関数・制御構造）',
  },
  yaya_function: {
    source: 'yaya_wiki' as Source,
    label: 'YAYA組み込み関数',
  },
  yaya_system: {
    source: 'yaya_wiki' as Source,
    label: 'YAYAシステム辞書',
  },
  yaya_tips: {
    source: 'yaya_wiki' as Source,
    label: '実践Tips（YAYA）',
  },
  yaya_startup: {
    source: 'yaya_wiki' as Source,
    label: 'チュートリアル・移行ガイド（YAYA）',
  },

  // --- 里々Wiki ---
  satori_reference: {
    source: 'satori_wiki' as Source,
    label: '里々リファレンス（特殊記号・演算子・変数・関数）',
  },
  satori_event: {
    source: 'satori_wiki' as Source,
    label: '里々独自イベント',
  },
  satori_tips: {
    source: 'satori_wiki' as Source,
    label: '実践Tips（里々）',
  },
  satori_saori: {
    source: 'satori_wiki' as Source,
    label: '里々 SAORI連携',
  },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;
