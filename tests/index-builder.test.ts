import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIndexFile, writeIndexAtomically } from '../src/index-builder.js';
import type { DocEntry } from '../src/types.js';

const tempDir = resolve('.tmp-tests-builder');

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const validEntries: DocEntry[] = [
  {
    id: 'ukadoc:a',
    title: 'a',
    source: 'ukadoc',
    category: 'sakurascript',
    content: 'a',
    url: 'https://example.com/a',
  },
  {
    id: 'yaya:b',
    title: 'b',
    source: 'yaya_wiki',
    category: 'yaya_function',
    content: 'b',
    url: 'https://example.com/b',
  },
  {
    id: 'satori:c',
    title: 'c',
    source: 'satori_wiki',
    category: 'satori_tips',
    content: 'c',
    url: 'https://example.com/c',
  },
];

describe('index-builder', () => {
  it('必須ソースが欠けるとビルド失敗する', () => {
    expect(() => buildIndexFile(validEntries.slice(0, 2))).toThrow(/Missing entries for required source: satori_wiki/);
  });

  it('重複 id があるとビルド失敗する', () => {
    expect(() => buildIndexFile([
      ...validEntries,
      { ...validEntries[0] },
    ])).toThrow(/Duplicate ids/i);
  });

  it('無効ページマーカーを含むエントリでビルド失敗する', () => {
    expect(() => buildIndexFile([
      ...validEntries.slice(0, 2),
      {
        ...validEntries[2],
        title: '有効なWikiNameではありません',
      },
    ])).toThrow(/Invalid pages detected/);
  });

  it('不正なエントリで buildIndexFile が失敗しても既存 index を壊さない', () => {
    mkdirSync(tempDir, { recursive: true });
    const outputPath = resolve(tempDir, 'index.json');
    writeFileSync(outputPath, '{"version":1,"generatedAt":"old","entries":[]}', 'utf-8');
    const before = readFileSync(outputPath, 'utf-8');

    expect(() => buildIndexFile([
      validEntries[0],
      { ...validEntries[1], source: 'ukadoc', id: 'ukadoc:dup' },
      { ...validEntries[2], source: 'ukadoc', id: 'ukadoc:dup' },
    ] as DocEntry[])).toThrow();

    expect(readFileSync(outputPath, 'utf-8')).toBe(before);
  });

  it('原子的に index を書き込む', () => {
    mkdirSync(tempDir, { recursive: true });
    const outputPath = resolve(tempDir, 'index.json');
    const indexFile = buildIndexFile(validEntries, '2026-04-03T00:00:00.000Z');

    writeIndexAtomically(outputPath, indexFile);

    const written = JSON.parse(readFileSync(outputPath, 'utf-8'));
    expect(written.entries).toHaveLength(3);
    expect(written.generatedAt).toBe('2026-04-03T00:00:00.000Z');
  });
});
