import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSatoriPage } from '../../src/parser/satori-scraper.js';

describe('parseSatoriPage', () => {
  it('見出しごとにエントリを作る', () => {
    const html = readFileSync(resolve('tests/fixtures/satori-page.html'), 'utf-8');
    const entries = parseSatoriPage(html, '特殊記号一覧', 'satori_reference');

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'satori:特殊記号一覧#mark',
      title: '特殊記号一覧 - 記号',
      source: 'satori_wiki',
    });
    expect(entries[0].content).toContain('特殊記号の説明。');
  });
});
