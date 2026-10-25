/**
 * SSP ヘルプパーサー
 *
 * docs/ukadoc-ssp/**\/*.md（git submodule: ukatech/ukadoc-ssp）をローカルでパースする。
 * ネットワークアクセスなし・レート制限不要。MkDocs 系サイト共通の処理は mkdocs.ts を参照。
 *
 * SSP ヘルプの正本は ukatech/ukadoc の ssphelp_src/（HTML、アーカイブ済み）から ukadoc-ssp（Markdown）に移った。
 * 旧 HTML 版の URL（ssp.shillest.net/ukadoc/ssphelp/*.html）は新しいサイトへ転送されている。
 */

import type { DocEntry } from '../types.js';
import { parseMkDocs } from './mkdocs.js';

/** ukadoc-ssp リポジトリ内の Markdown を全てパースして DocEntry 配列を返す */
export function parseSspHelp(rootDir: string): DocEntry[] {
  return parseMkDocs(rootDir, {
    idPrefix: 'ssphelp',
    source: 'ssp_help',
    baseUrl: 'https://ukatech.shillest.net/ukadoc-ssp/',
    rawBaseUrl: 'https://raw.githubusercontent.com/ukatech/ukadoc-ssp/refs/heads/main/',
    dirCategories: {
      howto: 'ssp_usage',
      functions: 'ssp_feature',
      config: 'ssp_config',
      about: 'ssp_info',
      dev: 'ssp_dev',
    },
    // 直下の INDEX.md は「はじめに」の本文（上流 .nav.yml の先頭）
    rootIndexCategory: 'ssp_usage',
    logTag: 'ssphelp-parser',
    displayName: 'SSP help',
  });
}
