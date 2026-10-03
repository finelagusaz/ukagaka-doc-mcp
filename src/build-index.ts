/**
 * ビルドスクリプト
 *
 * npm run build:index で実行する。
 * 全ソース（UKADOC, SSP ヘルプ, YAYA docs, 里々 docs, 蒼空Wiki, 湊 docs, Pasta docs）をパースして
 * data/index.json を生成する。
 *
 * Usage:
 *   npm run build:index
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DocEntry } from './types.js';
import { parseUkadocManual } from './parser/ukadoc-parser.js';
import { parseSspHelp } from './parser/ssphelp-parser.js';
import { parseYayaDocs } from './parser/yaya-docs-parser.js';
import { parseSatoriDocs } from './parser/satori-docs-parser.js';
import { parseAosoraWiki } from './parser/aosora-parser.js';
import { parseMinatoDocs } from './parser/minato-docs-parser.js';
import { parsePastaDocs } from './parser/pasta-docs-parser.js';
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

  // --- Phase 2: SSP ヘルプ ---
  console.error('[build-index] Parsing SSP help...');
  const ukadocDir = resolve(__dirname, '..', 'docs', 'ukadoc');
  const sspHelpEntries = parseSspHelp(ukadocDir);
  entries.push(...sspHelpEntries);
  console.error(`[build-index] SSP help: ${sspHelpEntries.length} entries`);

  // --- Phase 3: YAYA docs ---
  console.error('[build-index] Parsing YAYA docs...');
  const yayaDocsDir = resolve(__dirname, '..', 'docs', 'yaya-docs');
  const yayaEntries = parseYayaDocs(yayaDocsDir);
  entries.push(...yayaEntries);
  console.error(`[build-index] YAYA docs: ${yayaEntries.length} entries`);

  // --- Phase 4: 里々 docs ---
  console.error('[build-index] Parsing 里々 docs...');
  const satoriDocsDir = resolve(__dirname, '..', 'docs', 'satori-docs');
  const satoriEntries = parseSatoriDocs(satoriDocsDir);
  entries.push(...satoriEntries);
  console.error(`[build-index] 里々 docs: ${satoriEntries.length} entries`);

  // --- Phase 5: 蒼空 Wiki ---
  console.error('[build-index] Parsing aosora wiki...');
  const aosoraManualDir = resolve(__dirname, '..', 'docs', 'aosora-wiki', 'manual');
  const aosoraEntries = parseAosoraWiki(aosoraManualDir);
  entries.push(...aosoraEntries);
  console.error(`[build-index] aosora wiki: ${aosoraEntries.length} entries`);

  // --- Phase 6: 湊 docs ---
  console.error('[build-index] Parsing 湊 docs...');
  const minatoDocsDir = resolve(__dirname, '..', 'docs', 'minato', 'docs', 'src');
  const minatoEntries = parseMinatoDocs(minatoDocsDir);
  entries.push(...minatoEntries);
  console.error(`[build-index] 湊 docs: ${minatoEntries.length} entries`);

  // --- Phase 7: Pasta docs ---
  console.error('[build-index] Parsing Pasta docs...');
  const pastaDocsDir = resolve(__dirname, '..', 'docs', 'pasta', 'book', 'src');
  const pastaEntries = parsePastaDocs(pastaDocsDir);
  entries.push(...pastaEntries);
  console.error(`[build-index] Pasta docs: ${pastaEntries.length} entries`);

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
