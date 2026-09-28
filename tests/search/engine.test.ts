import { describe, expect, it } from 'vitest';
import { SearchEngine } from '../../src/search/engine.js';
import type { DocEntry } from '../../src/types.js';

const entries: DocEntry[] = [
  {
    id: 'ukadoc:list_sakura_script:tag_s0',
    title: '\\s0',
    source: 'ukadoc',
    category: 'sakurascript',
    content: '\\s0 はサーフェスを切り替える。',
    url: 'https://example.com/1',
  },
  {
    id: 'yaya:functions/REPLACE',
    title: 'REPLACE',
    source: 'yaya_docs',
    category: 'yaya_function',
    content: 'R'.repeat(600),
    url: 'https://example.com/2',
    rawUrl: 'https://example.com/2.md',
  },
];

describe('SearchEngine', () => {
  it('バックスラッシュ正規化付きで検索できる', () => {
    const engine = new SearchEngine();
    engine.load(entries);

    const result = engine.search('\\\\s0');
    expect(result.total).toBe(1);
    expect(result.results[0].id).toBe('ukadoc:list_sakura_script:tag_s0');
  });

  it('ソースとカテゴリで絞り込める', () => {
    const engine = new SearchEngine();
    engine.load(entries);

    const result = engine.search('replace', {
      source: 'yaya_docs',
      category: 'yaya_function',
    });

    expect(result.total).toBe(1);
    expect(result.results[0].id).toBe('yaya:functions/REPLACE');
  });

  it('summary を先頭500文字と明示的な省略記号で返す', () => {
    const engine = new SearchEngine();
    engine.load(entries);

    const result = engine.search('replace');
    expect(result.results[0].summary).toBe(`${'R'.repeat(500)}...`);
  });

  it('rawUrl はあるエントリにだけ付ける', () => {
    const engine = new SearchEngine();
    engine.load(entries);

    expect(engine.search('replace').results[0].rawUrl).toBe('https://example.com/2.md');
    expect(engine.search('\\s0').results[0]).not.toHaveProperty('rawUrl');
  });
});
