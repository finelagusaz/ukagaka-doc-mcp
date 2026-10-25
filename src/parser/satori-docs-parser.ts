/**
 * 里々 docs パーサー
 *
 * docs/satori-docs/{dir}/*.md（git submodule: ukatech/satori-docs）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。MkDocs 系サイト共通の処理は mkdocs.ts を参照。
 */

import type { DocEntry } from '../types.js';
import { parseMkDocs } from './mkdocs.js';

/** satori-docs リポジトリ内の Markdown を全てパースして DocEntry 配列を返す */
export function parseSatoriDocs(rootDir: string): DocEntry[] {
  return parseMkDocs(rootDir, {
    idPrefix: 'satori',
    source: 'satori_docs',
    baseUrl: 'https://ukatech.github.io/satori-docs/',
    rawBaseUrl: 'https://raw.githubusercontent.com/ukatech/satori-docs/refs/heads/main/',
    dirCategories: {
      startup: 'satori_startup',
      grammar: 'satori_grammar',
      shiori: 'satori_shiori',
      system: 'satori_system',
      functions: 'satori_function',
      ssu: 'satori_ssu',
      other: 'satori_other',
    },
    logTag: 'satori-docs-parser',
    displayName: 'Satori docs',
  });
}
