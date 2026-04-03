import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getFreshnessWarning, initializeSearchEngine } from '../src/bootstrap.js';
import type { IndexFile } from '../src/types.js';
import { parseAndValidateIndexFile } from '../src/index-validation.js';

const tempDir = resolve('.tmp-tests');

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('bootstrap', () => {
  it('index.json が存在しない場合は起動失敗する', () => {
    const indexPath = resolve(tempDir, 'missing.json');
    expect(() => initializeSearchEngine(indexPath)).toThrow(/Index file not found/);
  });

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

  it('重複 id を含む index.json では起動失敗する', () => {
    mkdirSync(tempDir, { recursive: true });
    const indexPath = resolve(tempDir, 'index.json');
    const indexFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: [
        {
          id: 'dup',
          title: 'a',
          source: 'ukadoc',
          category: 'sakurascript',
          content: 'x',
          url: 'https://example.com/a',
        },
        {
          id: 'dup',
          title: 'b',
          source: 'ukadoc',
          category: 'sakurascript',
          content: 'y',
          url: 'https://example.com/b',
        },
      ],
    };
    writeFileSync(indexPath, JSON.stringify(indexFile), 'utf-8');

    expect(() => initializeSearchEngine(indexPath)).toThrow(/duplicate ids/i);
  });

  it('version 不一致は警告扱いで継続できる', () => {
    const raw = JSON.stringify({
      version: 999,
      generatedAt: new Date().toISOString(),
      entries: [{
        id: 'ok',
        title: 'ok',
        source: 'ukadoc',
        category: 'sakurascript',
        content: 'ok',
        url: 'https://example.com',
      }],
    });

    const result = parseAndValidateIndexFile(raw);
    expect(result.warnings.some(warning => warning.includes('schema version mismatch'))).toBe(true);
  });

  it('未知カテゴリのみの index は起動失敗する', () => {
    mkdirSync(tempDir, { recursive: true });
    const indexPath = resolve(tempDir, 'index.json');
    writeFileSync(indexPath, JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: [{
        id: 'unknown',
        title: 'unknown',
        source: 'ukadoc',
        category: 'unknown_category',
        content: 'x',
        url: 'https://example.com',
      }],
    }), 'utf-8');

    expect(() => initializeSearchEngine(indexPath)).toThrow(/no valid entries/i);
  });
});
