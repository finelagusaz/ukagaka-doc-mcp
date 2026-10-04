import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseUkadocFile } from '../../src/parser/ukadoc-parser.js';

describe('parseUkadocFile', () => {
  it('定義リスト形式をエントリ化する', () => {
    const html = readFileSync(resolve('tests/fixtures/ukadoc-list.html'), 'utf-8');
    const entries = parseUkadocFile(html, 'list_sakura_script.html', 'sakurascript');

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'ukadoc:list_sakura_script:_s0',
      title: '\\s0',
      category: 'sakurascript',
      url: 'https://ssp.shillest.net/ukadoc/manual/list_sakura_script.html#_s0',
    });
    expect(entries[0].content).toContain('サーフェス0に切り替える。');
  });

  it('content を全文保存する', () => {
    const longText = 'a'.repeat(5000);
    const html = `<!doctype html><html><body><h1 id="page-title">spec</h1><h2 id="top">概要</h2><p>${longText}</p></body></html>`;
    const entries = parseUkadocFile(html, 'spec_web.html', 'protocol');

    expect(entries).toHaveLength(1);
    expect(entries[0].content).toContain(longText);
  });

  it('フォールバックIDに出現順を含めて衝突を避ける', () => {
    const html = `
      <!doctype html><html><body>
        <h1 id="page-title">spec</h1>
        <dl>
          <dt class="entry">\\_!</dt><dd>a</dd>
          <dt class="entry">\\_?</dt><dd>b</dd>
          <dt class="entry">\\_+</dt><dd>c</dd>
        </dl>
      </body></html>
    `;
    const entries = parseUkadocFile(html, 'list_sakura_script.html', 'sakurascript');

    expect(entries).toHaveLength(3);
    expect(new Set(entries.map(entry => entry.id)).size).toBe(3);
  });

  it('URL には元ページに実在するアンカーだけを付ける', () => {
    const html = `
      <!doctype html><html><body>
        <h1 id="page-title">spec</h1>
        <dl id="OnBoot,起動"><dt class="entry">OnBoot</dt><dd>a</dd></dl>
        <section id="request">
          <dl>
            <dt class="entry">メソッド</dt><dd>b</dd>
            <dt class="entry">バージョン</dt><dd>c</dd>
          </dl>
        </section>
        <dl><dt class="entry">孤立</dt><dd>d</dd></dl>
      </body></html>
    `;
    const entries = parseUkadocFile(html, 'spec_shiori3.html', 'protocol');
    const base = 'https://ssp.shillest.net/ukadoc/manual/spec_shiori3.html';

    expect(entries.map(entry => entry.url)).toEqual([
      `${base}#${encodeURIComponent('OnBoot,起動')}`,
      `${base}#request`,
      `${base}#request`,
      base,
    ]);
    // id は dl id があればそれを使い、無ければページ内で一意な値を生成する
    expect(entries[0].id).toBe('ukadoc:spec_shiori3:OnBoot,起動');
    expect(new Set(entries.map(entry => entry.id)).size).toBe(4);
  });
});
