/**
 * 湊 docs パーサー
 *
 * docs/minato/docs/src/**\/*.md（git submodule: mizuki-yura/minato）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。mdBook 共通の処理は mdbook.ts を参照。
 */

import type { DocEntry } from '../types.js';
import { parseMdBook } from './mdbook.js';

export { parseSummary } from './mdbook.js';

/** mdBook のソースディレクトリ（SUMMARY.md のあるディレクトリ）を全てパースして DocEntry 配列を返す */
export function parseMinatoDocs(srcDir: string): DocEntry[] {
  return parseMdBook(srcDir, {
    idPrefix: 'minato',
    source: 'minato_docs',
    baseUrl: 'https://mizuki-yura.github.io/minato/',
    rawBaseUrl: 'https://raw.githubusercontent.com/mizuki-yura/minato/refs/heads/master/docs/src/',
    topCategories: {
      README: 'minato_startup',
      intro: 'minato_startup',
      basic: 'minato_basic',
      data: 'minato_grammar',
      control: 'minato_grammar',
      func: 'minato_grammar',
      include: 'minato_grammar',
      talk: 'minato_talk',
      saori: 'minato_other',
      config: 'minato_other',
      error: 'minato_other',
      migration: 'minato_migration',
    },
    logTag: 'minato-docs-parser',
    displayName: 'Minato docs',
  });
}
