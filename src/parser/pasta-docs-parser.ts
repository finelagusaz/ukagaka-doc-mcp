/**
 * Pasta docs パーサー
 *
 * docs/pasta/book/src/**\/*.md（git submodule: ekicyou/pasta）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。mdBook 共通の処理は mdbook.ts を参照。
 */

import type { DocEntry } from '../types.js';
import { parseMdBook } from './mdbook.js';

/** mdBook のソースディレクトリ（SUMMARY.md のあるディレクトリ）を全てパースして DocEntry 配列を返す */
export function parsePastaDocs(srcDir: string): DocEntry[] {
  return parseMdBook(srcDir, {
    idPrefix: 'pasta',
    source: 'pasta_docs',
    baseUrl: 'https://ekicyou.github.io/pasta/',
    rawBaseUrl: 'https://raw.githubusercontent.com/ekicyou/pasta/refs/heads/main/book/src/',
    topCategories: {
      introduction: 'pasta_startup',
      'getting-started': 'pasta_startup',
      grammar: 'pasta_grammar',
      lua: 'pasta_lua',
      debug: 'pasta_debug',
      reference: 'pasta_reference',
      internals: 'pasta_internals',
    },
    logTag: 'pasta-docs-parser',
    displayName: 'Pasta docs',
  });
}
