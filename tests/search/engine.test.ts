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
    id: 'yaya:マニュアル/関数/REPLACE',
    title: 'REPLACE',
    source: 'yaya_wiki',
    category: 'yaya_function',
    content: 'REPLACE は文字列を置換する。',
    url: 'https://example.com/2',
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
      source: 'yaya_wiki',
      category: 'yaya_function',
    });

    expect(result.total).toBe(1);
    expect(result.results[0].id).toBe('yaya:マニュアル/関数/REPLACE');
  });
});
