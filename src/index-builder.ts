import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { INDEX_SCHEMA_VERSION } from './constants.js';
import { findDuplicateIds } from './index-validation.js';
import type { DocEntry, IndexFile, Source } from './types.js';

const REQUIRED_SOURCES: Source[] = ['ukadoc', 'yaya_wiki', 'satori_wiki'];
const INVALID_PAGE_MARKERS = ['有効なWikiNameではありません'];

export function buildIndexFile(entries: DocEntry[], generatedAt = new Date().toISOString()): IndexFile {
  validateEntriesForBuild(entries);

  return {
    version: INDEX_SCHEMA_VERSION,
    generatedAt,
    entries,
  };
}

export function validateEntriesForBuild(entries: DocEntry[]): void {
  if (entries.length === 0) {
    throw new Error('No entries collected');
  }

  const duplicateIds = findDuplicateIds(entries);
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate ids found: ${duplicateIds.slice(0, 10).join(', ')}`);
  }

  const invalidEntries = entries.filter(isInvalidEntry);
  if (invalidEntries.length > 0) {
    throw new Error(`Invalid pages detected in index entries: ${invalidEntries.slice(0, 10).map(entry => entry.id).join(', ')}`);
  }

  const sources = new Map<Source, number>();
  for (const entry of entries) {
    sources.set(entry.source, (sources.get(entry.source) ?? 0) + 1);
  }

  for (const source of REQUIRED_SOURCES) {
    if (!sources.has(source)) {
      throw new Error(`Missing entries for required source: ${source}`);
    }
  }
}

export function writeIndexAtomically(outputPath: string, indexFile: IndexFile): void {
  mkdirSync(dirname(outputPath), { recursive: true });

  const tempPath = join(
    dirname(outputPath),
    `.${basename(outputPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    writeFileSync(tempPath, JSON.stringify(indexFile, null, 2), 'utf-8');
    renameSync(tempPath, outputPath);
  } finally {
    if (existsSync(tempPath)) {
      rmSync(tempPath, { force: true });
    }
  }
}

function isInvalidEntry(entry: DocEntry): boolean {
  return INVALID_PAGE_MARKERS.some(marker =>
    entry.title.includes(marker) || entry.content.includes(marker),
  );
}
