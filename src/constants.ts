// ============================================================
// 定数定義（単一ソース）
// ============================================================

import type { Source } from './types.js';

// ============================================================
// ソース定義（単一ソース）
// ソースの追加・改名はここだけを直す。Source 型・zod enum・必須ソース検査・
// サーバー instructions・ツール description はすべてここから組み立てる。
// ============================================================

export interface SourceInfo {
  /** instructions の一覧に出す表示名 */
  name: string;
  /** search_docs の description に並べる短い名前 */
  shortName: string;
  /** instructions の一覧に出す収録内容 */
  description: string;
  /** get_doc の id 例（id 形式はソースごとに異なる） */
  exampleId: string;
}

export const SOURCES = {
  ukadoc: {
    name: 'UKADOC',
    shortName: 'UKADOC',
    description: 'SSP公式仕様書（さくらスクリプト、SHIORIイベント、設定ファイル仕様、プロトコル規格）',
    exampleId: 'ukadoc:list_shiori_event:OnBoot',
  },
  ssp_help: {
    name: 'SSPヘルプ',
    shortName: 'SSPヘルプ',
    description: 'SSP本体の使い方、機能、設定画面の各項目、FAQ、開発者向け機能',
    exampleId: 'ssphelp:config-ghost',
  },
  yaya_docs: {
    name: 'YAYA docs',
    shortName: 'YAYA',
    description: 'YAYA SHIORIの文法、組み込み関数、実践Tips',
    exampleId: 'yaya:functions/REPLACE',
  },
  satori_docs: {
    name: '里々 docs',
    shortName: '里々',
    description: '里々SHIORIの文法、SHIORIとしての動作、システム変数、内蔵関数、ssu',
    exampleId: 'satori:functions/set',
  },
  aosora_wiki: {
    name: '蒼空(Aosora) Wiki',
    shortName: '蒼空',
    description: '蒼空スクリプトの文法、組み込み機能、発展的トピック',
    exampleId: 'aosora:04_04_変数',
  },
  minato_docs: {
    name: '湊 docs',
    shortName: '湊',
    description: '湊（Minato）SHIORIの文法、トーク制御、ビルトイン関数、里々・YAYAからの移行ガイド',
    exampleId: 'minato:func/builtin',
  },
  pasta_docs: {
    name: 'Pasta docs',
    shortName: 'Pasta',
    description: 'Pasta SHIORIのPasta DSL文法、Lua API、SHIORIイベント、デバッグ、内部設計',
    exampleId: 'pasta:grammar/markers',
  },
} as const satisfies Record<string, SourceInfo>;

/** 全ソース種別（SOURCES の定義順。types.ts の Source 型と各所の zod enum がここから派生） */
export const SOURCE_VALUES = Object.keys(SOURCES) as [keyof typeof SOURCES, ...(keyof typeof SOURCES)[]];

/** インデックスが stale とみなされるまでの日数 */
export const STALE_AFTER_DAYS = 7;

/** HTTP モードのデフォルト listen ホスト */
export const DEFAULT_HTTP_HOST = '127.0.0.1';

/** HTTP モードのデフォルト listen ポート */
export const DEFAULT_HTTP_PORT = 8951;

/** HTTP モードでインデックスを取得する URL */
export const REMOTE_INDEX_URL =
  'https://github.com/finelagusaz/ukagaka-doc-mcp/raw/refs/heads/main/data/index.json';

/** HTTP モードでのインデックス更新間隔 (ms) */
export const INDEX_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** インデックス取得のタイムアウト (ms) */
export const INDEX_FETCH_TIMEOUT_MS = 60 * 1000;

/** インデックスファイルの現在のスキーマバージョン */
export const INDEX_SCHEMA_VERSION = 1;

/** search_docs で返す summary の最大文字数 */
export const SUMMARY_MAX_LENGTH = 500;

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

  // --- SSP ヘルプ ---
  ssp_usage: {
    source: 'ssp_help' as Source,
    label: 'SSPの使い方（はじめに・起動・ゴーストとあそぶ・右クリックメニュー 等）',
  },
  ssp_feature: {
    source: 'ssp_help' as Source,
    label: 'SSPの機能（カレンダー・エクスプローラ・ビューワ・ショートカット・起動オプション 等）',
  },
  ssp_config: {
    source: 'ssp_help' as Source,
    label: 'SSPの設定（ゴーストごとの設定・本体設定の各ページ）',
  },
  ssp_info: {
    source: 'ssp_help' as Source,
    label: 'SSPの情報（FAQ・用語説明・リンク集・基本情報）',
  },
  ssp_dev: {
    source: 'ssp_help' as Source,
    label: 'SSP開発者向けヘルプ（スクリプトログ・開発用パレット・開発FAQ 等）',
  },

  // --- YAYA docs ---
  yaya_grammar: {
    source: 'yaya_docs' as Source,
    label: 'YAYA言語文法',
  },
  yaya_basic: {
    source: 'yaya_docs' as Source,
    label: 'YAYA基礎概念（変数・関数・制御構造）',
  },
  yaya_function: {
    source: 'yaya_docs' as Source,
    label: 'YAYA組み込み関数',
  },
  yaya_system: {
    source: 'yaya_docs' as Source,
    label: 'YAYAシステム辞書',
  },
  yaya_tips: {
    source: 'yaya_docs' as Source,
    label: '実践Tips（YAYA）',
  },
  yaya_startup: {
    source: 'yaya_docs' as Source,
    label: 'チュートリアル・移行ガイド（YAYA）',
  },
  yaya_other: {
    source: 'yaya_docs' as Source,
    label: 'YAYAその他（SAORI/MAKOTO/PLUGIN・変更点・トラブルシューティング 等）',
  },

  // --- 里々 docs ---
  satori_startup: {
    source: 'satori_docs' as Source,
    label: '里々入門（里々とは・はじめてのゴースト・チートシート）',
  },
  satori_grammar: {
    source: 'satori_docs' as Source,
    label: '里々文法（辞書・文と単語群・（）の展開・変数・式・制御構造 等）',
  },
  satori_shiori: {
    source: 'satori_docs' as Source,
    label: '里々のSHIORIとしての動作（イベント処理・独自イベント・ランダムトーク 等）',
  },
  satori_system: {
    source: 'satori_docs' as Source,
    label: '里々システム変数・組み込み名',
  },
  satori_function: {
    source: 'satori_docs' as Source,
    label: '里々（）内蔵関数',
  },
  satori_ssu: {
    source: 'satori_docs' as Source,
    label: 'ssu（里々同梱SAORI）の関数',
  },
  satori_other: {
    source: 'satori_docs' as Source,
    label: '里々その他（エラーメッセージ・SAORI・Unicode版の変更点 等）',
  },

  // --- 蒼空 (aosora) Wiki ---
  aosora_grammar: {
    source: 'aosora_wiki' as Source,
    label: '蒼空スクリプト文法（関数・トーク・データ型）',
  },
  aosora_builtin: {
    source: 'aosora_wiki' as Source,
    label: '蒼空組み込み機能・stdユニット',
  },
  aosora_advanced: {
    source: 'aosora_wiki' as Source,
    label: '蒼空発展的トピック（ユニット・クラス・例外）',
  },
  aosora_general: {
    source: 'aosora_wiki' as Source,
    label: '蒼空全般（導入・SHIORIイベント・プロジェクト設定 等）',
  },

  // --- 湊 docs ---
  minato_startup: {
    source: 'minato_docs' as Source,
    label: '湊入門（湊とは・インストールと最初のゴースト）',
  },
  minato_basic: {
    source: 'minato_docs' as Source,
    label: '湊の基本の書き方（ファイル構成・トーク定義・セリフの書き方・コメント）',
  },
  minato_grammar: {
    source: 'minato_docs' as Source,
    label: '湊文法（変数とデータ・制御構文・関数・include）',
  },
  minato_talk: {
    source: 'minato_docs' as Source,
    label: '湊トーク制御（条件フィルタ・ランダムトーク・now/reference）',
  },
  minato_other: {
    source: 'minato_docs' as Source,
    label: '湊その他（SAORI連携・config.toml・エラーと対処）',
  },
  minato_migration: {
    source: 'minato_docs' as Source,
    label: '里々・YAYAから湊への移行ガイド',
  },

  // --- Pasta docs ---
  pasta_startup: {
    source: 'pasta_docs' as Source,
    label: 'Pasta入門（はじめに・前提環境と準備・最初のゴースト）',
  },
  pasta_grammar: {
    source: 'pasta_docs' as Source,
    label: 'Pasta DSL文法（マーカー・ブロック構造・Call/Jump・変数・単語・アクター辞書 等）',
  },
  pasta_lua: {
    source: 'pasta_docs' as Source,
    label: 'Pasta Lua API（公開モジュール・SHIORIイベントとハンドラ・ランタイムAPI・記述パターン）',
  },
  pasta_debug: {
    source: 'pasta_docs' as Source,
    label: 'Pastaデバッグ（VSCode接続・ソースレベルデバッグ・開発支援アクション・トラブルシューティング）',
  },
  pasta_reference: {
    source: 'pasta_docs' as Source,
    label: 'Pastaリファレンス（起動シーケンスとモジュール解決・pasta.toml・外部リンク集）',
  },
  pasta_internals: {
    source: 'pasta_docs' as Source,
    label: 'Pasta内部設計（コントリビュータ向け: トランスパイラ・実行モデル・SHIORI層 等）',
  },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;
