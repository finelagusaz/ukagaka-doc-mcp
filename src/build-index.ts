/**
 * ビルドスクリプト
 *
 * npm run build:index で実行する。
 * 全ソース（UKADOC, YAYA Wiki, 里々Wiki）をパース・スクレイプして
 * data/index.json を生成する。
 *
 * Usage:
 *   npm run build:index
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DocEntry } from './types.js';
import { parseUkadocManual } from './parser/ukadoc-parser.js';
import { scrapeYayaWiki } from './parser/yaya-scraper.js';
import { scrapeSatoriWiki } from './parser/satori-scraper.js';
import { buildIndexFile, writeIndexAtomically } from './index-builder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const startTime = Date.now();
  console.error('[build-index] Starting index build...');

  const entries: DocEntry[] = [];

  // --- Phase 1: UKADOC ---
  console.error('[build-index] Parsing UKADOC...');
  const ukadocManualDir = resolve(__dirname, '..', 'docs', 'ukadoc', 'manual');
  const ukadocEntries = parseUkadocManual(ukadocManualDir);
  entries.push(...ukadocEntries);
  console.error(`[build-index] UKADOC: ${ukadocEntries.length} entries`);

  // --- Phase 2: YAYA Wiki ---
  console.error('[build-index] Scraping YAYA Wiki...');
  const yayaEntries = await scrapeYayaWiki();
  entries.push(...yayaEntries);
  console.error(`[build-index] YAYA Wiki: ${yayaEntries.length} entries`);

  // --- Phase 3: 里々Wiki ---
  console.error('[build-index] Scraping 里々Wiki...');
  const satoriEntries = await scrapeSatoriWiki();
  entries.push(...satoriEntries);
  console.error(`[build-index] 里々Wiki: ${satoriEntries.length} entries`);

  // --- 統合 ---
  const indexFile = buildIndexFile(entries);
  const outputPath = resolve(__dirname, '..', 'data', 'index.json');
  writeIndexAtomically(outputPath, indexFile);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(indexFile)) / 1024);

  console.error(`[build-index] Done: ${entries.length} entries, ${sizeKb} KB, ${elapsed}s`);
  console.error(`[build-index] Output: ${outputPath}`);
}

main().catch(err => {
  console.error('[build-index] Fatal error:', err);
  process.exit(1);
});
