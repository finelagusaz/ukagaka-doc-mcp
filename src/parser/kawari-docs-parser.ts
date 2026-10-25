/**
 * 華和梨 docs パーサー
 *
 * docs/kawari-docs/{dir}/*.md（git submodule: ukatech/kawari-docs）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。MkDocs 系サイト共通の処理は mkdocs.ts を参照。
 *
 * 上流サイトは kis/・grammar/・migration/・spec/ のファイルを分類・章ごとの 1 ページにまとめて配信するが、
 * 元ファイルの URL（kis/if/ など）にはまとめたページの見出しへ転送する HTML を置いている。
 * url はその元ファイルの URL を指す（まとめ方が変わっても切れない）。
 */

import type { DocEntry } from '../types.js';
import { parseMkDocs } from './mkdocs.js';

/** kawari-docs リポジトリ内の Markdown を全てパースして DocEntry 配列を返す */
export function parseKawariDocs(rootDir: string): DocEntry[] {
  return parseMkDocs(rootDir, {
    idPrefix: 'kawari',
    source: 'kawari_docs',
    baseUrl: 'https://ukatech.shillest.net/kawari-docs/',
    rawBaseUrl: 'https://raw.githubusercontent.com/ukatech/kawari-docs/refs/heads/main/',
    dirCategories: {
      startup: 'kawari_startup',
      grammar: 'kawari_grammar',
      shiori: 'kawari_shiori',
      kis: 'kawari_kis',
      kosui: 'kawari_kosui',
      tips: 'kawari_tips',
      migration: 'kawari_migration',
      spec: 'kawari_spec',
      other: 'kawari_other',
    },
    logTag: 'kawari-docs-parser',
    displayName: 'Kawari docs',
  });
}
