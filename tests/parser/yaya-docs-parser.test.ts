import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocEntry } from '../../src/types.js';
import { resolve } from 'node:path';
import { parseYayaDocs } from '../../src/parser/yaya-docs-parser.js';

const fixtureDir = resolve('tests/fixtures/yaya-docs');

describe('parseYayaDocs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let entries: DocEntry[];
  let byId: Map<string, DocEntry>;

  beforeAll(() => {
    // 未知ディレクトリの警告は専用テストで検証する
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    entries = parseYayaDocs(fixtureDir);
    byId = new Map(entries.map(e => [e.id, e]));
    warn.mockRestore();
  });

  it('既知ディレクトリのページだけを 1 ページ 1 エントリで取り込む', () => {
    expect([...byId.keys()].sort()).toEqual([
      'yaya:functions/REPLACE',
      'yaya:grammar/07-flow-control',
      'yaya:other/yaya-as-saori',
      'yaya:system/yaya-shiori3-dic',
    ]);
  });

  it('目次ページ（INDEX.md・system-functions-index）を除外する', () => {
    expect(byId.has('yaya:system/system-functions-index')).toBe(false);
    expect(entries.some(e => e.content.includes('目次'))).toBe(false);
  });

  it('ディレクトリからカテゴリを割り当てる', () => {
    expect(byId.get('yaya:functions/REPLACE')?.category).toBe('yaya_function');
    expect(byId.get('yaya:grammar/07-flow-control')?.category).toBe('yaya_grammar');
    expect(byId.get('yaya:system/yaya-shiori3-dic')?.category).toBe('yaya_system');
    expect(byId.get('yaya:other/yaya-as-saori')?.category).toBe('yaya_other');
  });

  it('source と url は GitHub Pages のページを指す', () => {
    const entry = byId.get('yaya:functions/REPLACE');
    expect(entry?.source).toBe('yaya_docs');
    expect(entry?.url).toBe('https://yaya-shiori.github.io/yaya-docs/functions/REPLACE/');
    expect(entry?.rawUrl).toBe('https://raw.githubusercontent.com/YAYA-shiori/yaya-docs/refs/heads/main/functions/REPLACE.md');
  });

  it('title は先頭 h1 見出し、無ければファイル名', () => {
    expect(byId.get('yaya:functions/REPLACE')?.title).toBe('REPLACE');
    expect(byId.get('yaya:grammar/07-flow-control')?.title).toBe('07-flow-control');
  });

  it('本文はプレーンテキスト化し、表の \\| を | に戻す', () => {
    const content = byId.get('yaya:functions/REPLACE')?.content ?? '';
    expect(content).toContain('REPLACE( src , before , after [ , count ] )');
    expect(content).toContain('| before | 区切りの例: a|b |');
    expect(content).toContain('- ERASE');
    expect(content).not.toContain('**');
  });

  it('未知のディレクトリは警告してスキップし、assets・overrides・attachment は黙って除外する', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = parseYayaDocs(fixtureDir);
    expect(result.some(e => e.id.startsWith('yaya:unknown-dir/'))).toBe(false);
    expect(result.some(e => e.id.startsWith('yaya:overrides/'))).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown-dir'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('assets'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('overrides'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('attachment'));
  });

  it('ディレクトリが無ければ submodule 初期化を促して失敗する', () => {
    expect(() => parseYayaDocs(resolve('tests/fixtures/no-such-dir'))).toThrow(/git submodule update/);
  });
});
