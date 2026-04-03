import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_MAX_LENGTH } from '../../src/constants.js';
import { parseUkadocFile } from '../../src/parser/ukadoc-parser.js';

describe('parseUkadocFile', () => {
  it('定義リスト形式をエントリ化する', () => {
    const html = readFileSync(resolve('tests/fixtures/ukadoc-list.html'), 'utf-8');
    const entries = parseUkadocFile(html, 'list_sakura_script.html', 'sakurascript');

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'ukadoc:list_sakura_script:tag_s0',
      title: '\\s0',
      category: 'sakurascript',
    });
    expect(entries[0].content).toContain('サーフェス0に切り替える。');
  });

  it('content を 4000 文字で打ち切る', () => {
    const longText = 'a'.repeat(CONTENT_MAX_LENGTH + 100);
    const html = `<!doctype html><html><body><h1 id="page-title">spec</h1><h2 id="top">概要</h2><p>${longText}</p></body></html>`;
    const entries = parseUkadocFile(html, 'spec_web.html', 'protocol');

    expect(entries).toHaveLength(1);
    expect(entries[0].content.length).toBeLessThanOrEqual(CONTENT_MAX_LENGTH + 3);
    expect(entries[0].content.endsWith('...')).toBe(true);
  });
});
