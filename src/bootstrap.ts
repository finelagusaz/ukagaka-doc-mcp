/**
 * bootstrap.ts
 *
 * サーバー起動時の初期化処理:
 * 1. data/index.json を読み込む
 * 2. freshness 判定（7日超なら stderr に警告）
 * 3. SearchEngine にロード
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { IndexFile } from './types.js';
import { SearchEngine } from './search/engine.js';
import { STALE_AFTER_DAYS, INDEX_SCHEMA_VERSION } from './constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function resolveDefaultIndexPath(): string {
  // src/ の親である プロジェクトルートから data/index.json を探す
  return resolve(__dirname, '..', 'data', 'index.json');
}

export function getFreshnessWarning(generatedAt: string, now = Date.now()): string | null {
  const builtAt = new Date(generatedAt);
  if (isNaN(builtAt.getTime())) {
    return '[bootstrap] Warning: Invalid generatedAt in index.json';
  }
  const daysSince = (now - builtAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > STALE_AFTER_DAYS) {
    const days = Math.floor(daysSince);
    return `[bootstrap] Warning: Index is stale (built ${days} days ago). Consider rebuilding:\n  npm run build:index`;
  }

  return null;
}

/**
 * data/index.json を読み込み、SearchEngine を初期化して返す。
 * index.json が存在しない場合は Error を throw する。
 */
export function initializeSearchEngine(indexPath = resolveDefaultIndexPath()): SearchEngine {

  if (!existsSync(indexPath)) {
    throw new Error(
      `Index file not found: ${indexPath}\n` +
      `Run: npm run build:index`
    );
  }

  let indexFile: IndexFile;
  try {
    const raw = readFileSync(indexPath, 'utf-8');
    indexFile = JSON.parse(raw) as IndexFile;
  } catch (err) {
    throw new Error(`Failed to parse index.json: ${err}`);
  }

  // スキーマバージョンチェック
  if (indexFile.version !== INDEX_SCHEMA_VERSION) {
    console.error(
      `[bootstrap] Warning: Index schema version mismatch (expected ${INDEX_SCHEMA_VERSION}, got ${indexFile.version}). ` +
      `Consider rebuilding: npm run build:index`,
    );
  }

  // freshness 判定
  const freshnessWarning = getFreshnessWarning(indexFile.generatedAt);
  if (freshnessWarning) {
    console.error(freshnessWarning);
  }

  const engine = new SearchEngine();
  engine.load(indexFile.entries);
  console.error(
    `[bootstrap] Loaded ${engine.size} entries from index (built: ${indexFile.generatedAt})`,
  );

  return engine;
}
