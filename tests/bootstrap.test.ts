import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getFreshnessWarning, initializeSearchEngine } from '../src/bootstrap.js';
import type { IndexFile } from '../src/types.js';

const tempDir = resolve('.tmp-tests');

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('bootstrap', () => {
  it('freshness 警告を返す', () => {
    const now = new Date('2026-04-03T00:00:00.000Z').getTime();
    const warning = getFreshnessWarning('2026-03-20T00:00:00.000Z', now);

    expect(warning).toContain('Index is stale');
  });

  it('指定した index.json から検索エンジンを初期化する', () => {
    mkdirSync(tempDir, { recursive: true });
    const indexPath = resolve(tempDir, 'index.json');
    const indexFile: IndexFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: [{
        id: 'ukadoc:list_sakura_script:tag_s0',
        title: '\\s0',
        source: 'ukadoc',
        category: 'sakurascript',
        content: 'sample',
        url: 'https://example.com',
      }],
    };
    writeFileSync(indexPath, JSON.stringify(indexFile), 'utf-8');

    const engine = initializeSearchEngine(indexPath);
    expect(engine.size).toBe(1);
    expect(engine.getById('ukadoc:list_sakura_script:tag_s0')?.title).toBe('\\s0');
  });
});
