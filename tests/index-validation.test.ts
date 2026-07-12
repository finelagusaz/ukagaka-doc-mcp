import { describe, expect, it } from 'vitest';
import { parseAndValidateIndexFile } from '../src/index-validation.js';

describe('index-validation', () => {
  it('JSONパース失敗では例外を投げる', () => {
    expect(() => parseAndValidateIndexFile('{')).toThrow(/Failed to parse index\.json/);
  });

  it('entries が空なら例外を投げる', () => {
    expect(() => parseAndValidateIndexFile(JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: [],
    }))).toThrow(/Invalid index\.json structure/);
  });

  it('content が空なら例外を投げる', () => {
    expect(() => parseAndValidateIndexFile(JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: [{
        id: 'a',
        title: 'a',
        source: 'ukadoc',
        category: 'sakurascript',
        content: '',
        url: 'https://example.com',
      }],
    }))).toThrow(/Invalid index\.json structure/);
  });

  it('generatedAt 不正は警告付きで継続する', () => {
    const result = parseAndValidateIndexFile(JSON.stringify({
      version: 1,
      generatedAt: 'invalid-date',
      entries: [{
        id: 'a',
        title: 'a',
        source: 'ukadoc',
        category: 'sakurascript',
        content: 'ok',
        url: 'https://example.com',
      }],
    }));

    expect(result.warnings).toContain('[bootstrap] Warning: Invalid generatedAt in index.json');
    expect(result.indexFile.entries).toHaveLength(1);
  });

  it('未知カテゴリを落として警告する', () => {
    const result = parseAndValidateIndexFile(JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: [
        {
          id: 'known',
          title: 'known',
          source: 'ukadoc',
          category: 'sakurascript',
          content: 'ok',
          url: 'https://example.com/known',
        },
        {
          id: 'unknown',
          title: 'unknown',
          source: 'ukadoc',
          category: 'unknown_category',
          content: 'ng',
          url: 'https://example.com/unknown',
        },
      ],
    }));

    expect(result.warnings.some(warning => warning.includes('Dropping 1 entries with unknown categories'))).toBe(true);
    expect(result.indexFile.entries).toHaveLength(1);
    expect(result.indexFile.entries[0].id).toBe('known');
  });

  it('aosora_wiki ソースのエントリを受理する', () => {
    const { indexFile } = parseAndValidateIndexFile(JSON.stringify({
      version: 1,
      generatedAt: '2026-07-12T00:00:00.000Z',
      entries: [
        {
          id: 'aosora:04_04_変数',
          title: '変数',
          source: 'aosora_wiki',
          category: 'aosora_grammar',
          content: 'ローカル変数とグローバル変数',
          url: 'https://github.com/kanadelab/aosora-shiori/wiki/04_04_%E5%A4%89%E6%95%B0',
        },
      ],
    }));
    expect(indexFile.entries).toHaveLength(1);
    expect(indexFile.entries[0].source).toBe('aosora_wiki');
  });
});
