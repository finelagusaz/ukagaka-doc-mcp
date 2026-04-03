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

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUkadocManual } from './parser/ukadoc-parser.js';
import { scrapeYayaWiki } from './parser/yaya-scraper.js';
import { scrapeSatoriWiki } from './parser/satori-scraper.js';
import type { IndexFile } from './types.js';
import { INDEX_SCHEMA_VERSION } from './constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const startTime = Date.now();
  console.error('[build-index] Starting index build...');

  const entries = [];

  // --- Phase 1: UKADOC ---
  console.error('[build-index] Parsing UKADOC...');
  const ukadocManualDir = resolve(__dirname, '..', 'docs', 'ukadoc', 'manual');
  try {
    const ukadocEntries = parseUkadocManual(ukadocManualDir);
    entries.push(...ukadocEntries);
    console.error(`[build-index] UKADOC: ${ukadocEntries.length} entries`);
  } catch (err) {
    console.error(`[build-index] UKADOC parse failed: ${err}`);
    process.exit(1);
  }

  // --- Phase 2: YAYA Wiki ---
  console.error('[build-index] Scraping YAYA Wiki...');
  try {
    const yayaEntries = await scrapeYayaWiki();
    entries.push(...yayaEntries);
    console.error(`[build-index] YAYA Wiki: ${yayaEntries.length} entries`);
  } catch (err) {
    console.error(`[build-index] YAYA Wiki scrape failed: ${err}`);
    // 失敗しても続行（UKADOC だけでも動く）
  }

  // --- Phase 3: 里々Wiki ---
  console.error('[build-index] Scraping 里々Wiki...');
  try {
    const satoriEntries = await scrapeSatoriWiki();
    entries.push(...satoriEntries);
    console.error(`[build-index] 里々Wiki: ${satoriEntries.length} entries`);
  } catch (err) {
    console.error(`[build-index] 里々Wiki scrape failed: ${err}`);
    // 失敗しても続行
  }

  // --- 統合 ---
  const indexFile: IndexFile = {
    version: INDEX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    entries,
  };

  const outputPath = resolve(__dirname, '..', 'data', 'index.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(indexFile, null, 2), 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(indexFile)) / 1024);

  console.error(`[build-index] Done: ${entries.length} entries, ${sizeKb} KB, ${elapsed}s`);
  console.error(`[build-index] Output: ${outputPath}`);
}

main().catch(err => {
  console.error('[build-index] Fatal error:', err);
  process.exit(1);
});
