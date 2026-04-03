import { z } from 'zod';
import { CATEGORIES, INDEX_SCHEMA_VERSION } from './constants.js';
import type { Category, DocEntry, IndexFile } from './types.js';

const SOURCE_VALUES = ['ukadoc', 'yaya_wiki', 'satori_wiki'] as const;
const KNOWN_CATEGORY_SET = new Set(Object.keys(CATEGORIES));

const rawDocEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  source: z.enum(SOURCE_VALUES),
  category: z.string().min(1),
  content: z.string().min(1),
  url: z.string().min(1),
});

const rawIndexFileSchema = z.object({
  version: z.number(),
  generatedAt: z.string(),
  entries: z.array(rawDocEntrySchema).nonempty(),
});

export interface IndexValidationResult {
  indexFile: IndexFile;
  warnings: string[];
}

export function parseAndValidateIndexFile(raw: string): IndexValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse index.json: ${error}`);
  }

  return validateIndexFile(parsed);
}

export function validateIndexFile(value: unknown): IndexValidationResult {
  const parsed = rawIndexFileSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid index.json structure: ${parsed.error.issues.map(issue => issue.path.join('.') || '(root)').join(', ')}`);
  }

  const warnings: string[] = [];

  if (parsed.data.version !== INDEX_SCHEMA_VERSION) {
    warnings.push(
      `[bootstrap] Warning: Index schema version mismatch (expected ${INDEX_SCHEMA_VERSION}, got ${parsed.data.version}). Consider rebuilding: npm run build:index`,
    );
  }

  if (Number.isNaN(new Date(parsed.data.generatedAt).getTime())) {
    warnings.push('[bootstrap] Warning: Invalid generatedAt in index.json');
  }

  const unknownCategoryEntries = parsed.data.entries.filter(entry => !KNOWN_CATEGORY_SET.has(entry.category));
  if (unknownCategoryEntries.length > 0) {
    warnings.push(
      `[bootstrap] Warning: Dropping ${unknownCategoryEntries.length} entries with unknown categories.`,
    );
  }

  const entries = parsed.data.entries
    .filter((entry): entry is typeof entry & { category: Category } => KNOWN_CATEGORY_SET.has(entry.category))
    .map(entry => ({
      ...entry,
      category: entry.category,
    }));

  if (entries.length === 0) {
    throw new Error('Index has no valid entries');
  }

  const duplicateIds = findDuplicateIds(entries);
  if (duplicateIds.length > 0) {
    throw new Error(`Index contains duplicate ids: ${duplicateIds.slice(0, 10).join(', ')}`);
  }

  return {
    indexFile: {
      version: parsed.data.version,
      generatedAt: parsed.data.generatedAt,
      entries,
    },
    warnings,
  };
}

export function findDuplicateIds(entries: Array<Pick<DocEntry, 'id'>>): string[] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
}
