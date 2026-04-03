import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseYayaPage } from '../../src/parser/yaya-scraper.js';

describe('parseYayaPage', () => {
  it('セクション単位で分割する', () => {
    const html = readFileSync(resolve('tests/fixtures/yaya-page.html'), 'utf-8');
    const entries = parseYayaPage(html, 'マニュアル/関数/REPLACE', 'yaya_function');

    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('yaya:マニュアル/関数/REPLACE#summary');
    expect(entries[1].id).toBe('yaya:マニュアル/関数/REPLACE#example');
  });

  it('onePageOneEntry ではページ全体を1件にする', () => {
    const html = readFileSync(resolve('tests/fixtures/yaya-page.html'), 'utf-8');
    const entries = parseYayaPage(html, 'マニュアル/関数/REPLACE', 'yaya_function', true);

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('yaya:マニュアル/関数/REPLACE');
    expect(entries[0].content).toContain('文字列を置換する関数です。');
  });
});
