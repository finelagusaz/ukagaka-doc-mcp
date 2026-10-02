import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocEntry } from '../../src/types.js';
import { resolve } from 'node:path';
import { parseSatoriDocs } from '../../src/parser/satori-docs-parser.js';

const fixtureDir = resolve('tests/fixtures/satori-docs');

describe('parseSatoriDocs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let entries: DocEntry[];
  let byId: Map<string, DocEntry>;

  beforeAll(() => {
    // 未知ディレクトリの警告は専用テストで検証する
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    entries = parseSatoriDocs(fixtureDir);
    byId = new Map(entries.map(e => [e.id, e]));
    warn.mockRestore();
  });

  it('既知ディレクトリのページだけを 1 ページ 1 エントリで取り込む（直下の INDEX.md は除く）', () => {
    expect([...byId.keys()].sort()).toEqual([
      'satori:functions/index',
      'satori:functions/set',
      'satori:grammar/06-variables',
      'satori:ssu/calc',
    ]);
    expect(entries.some(e => e.content.includes('目次'))).toBe(false);
  });

  it('ディレクトリからカテゴリを割り当てる', () => {
    expect(byId.get('satori:functions/set')?.category).toBe('satori_function');
    expect(byId.get('satori:functions/index')?.category).toBe('satori_function');
    expect(byId.get('satori:grammar/06-variables')?.category).toBe('satori_grammar');
    expect(byId.get('satori:ssu/calc')?.category).toBe('satori_ssu');
  });

  it('source と url は GitHub Pages のページ、rawUrl は生 Markdown を指す', () => {
    const entry = byId.get('satori:functions/set');
    expect(entry?.source).toBe('satori_docs');
    expect(entry?.url).toBe('https://ukatech.github.io/satori-docs/functions/set/');
    expect(entry?.rawUrl).toBe('https://raw.githubusercontent.com/ukatech/satori-docs/refs/heads/main/functions/set.md');
  });

  it('ディレクトリの index.md はディレクトリ URL で配信される', () => {
    const entry = byId.get('satori:functions/index');
    expect(entry?.url).toBe('https://ukatech.github.io/satori-docs/functions/');
    expect(entry?.rawUrl).toBe('https://raw.githubusercontent.com/ukatech/satori-docs/refs/heads/main/functions/index.md');
  });

  it('title は先頭 h1 見出し、無ければファイル名', () => {
    expect(byId.get('satori:functions/index')?.title).toBe('（）内蔵関数');
    expect(byId.get('satori:ssu/calc')?.title).toBe('calc');
  });

  it('本文はプレーンテキスト化し、admonition の見出し行はタイトルだけ残す', () => {
    const content = byId.get('satori:functions/set')?.content ?? '';
    expect(content).toContain('（set、好感度、10）');
    expect(content).toContain('式の中のカッコ');
    expect(content).toContain('計算の順序を指定するカッコは半角の ( ) で書きます。');
    expect(content).not.toContain('!!!');
    expect(content).toContain('- when');
    expect(byId.get('satori:grammar/06-variables')?.content).not.toContain('**');
  });

  it('未知のディレクトリは警告してスキップし、assets・overrides は黙って除外する', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = parseSatoriDocs(fixtureDir);
    expect(result.some(e => e.id.startsWith('satori:unknown-dir/'))).toBe(false);
    expect(result.some(e => e.id.startsWith('satori:overrides/'))).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown-dir'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('assets'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('overrides'));
  });

  it('ディレクトリが無ければ submodule 初期化を促して失敗する', () => {
    expect(() => parseSatoriDocs(resolve('tests/fixtures/no-such-dir'))).toThrow(/git submodule update/);
  });
});
