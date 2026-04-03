import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeSatoriWikiHref, parseSatoriPage } from '../../src/parser/satori-scraper.js';

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

  it('フラグメント付きの Wiki リンクを正規化する', () => {
    expect(normalizeSatoriWikiHref('./?TIPS総合#anchor')).toBe('?TIPS総合');
    expect(normalizeSatoriWikiHref('#anchor')).toBeNull();
  });

  it('エラーページは空結果にする', () => {
    const html = '<html><body><h1>有効なWikiNameではありません</h1><div id="body">有効なWikiNameではありません</div></body></html>';
    expect(parseSatoriPage(html, 'TIPS総合#bad', 'satori_tips')).toEqual([]);
  });
});
