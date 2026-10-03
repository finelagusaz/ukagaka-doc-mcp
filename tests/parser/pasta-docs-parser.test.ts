import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocEntry } from '../../src/types.js';
import { resolve } from 'node:path';
import { parsePastaDocs } from '../../src/parser/pasta-docs-parser.js';

// 目次・警告など mdBook 共通の挙動は minato-docs-parser.test.ts で検証している
const fixtureDir = resolve('tests/fixtures/pasta-docs');

describe('parsePastaDocs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let entries: DocEntry[];
  let byId: Map<string, DocEntry>;
  let warnings: string[];

  beforeAll(() => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    entries = parsePastaDocs(fixtureDir);
    byId = new Map(entries.map(e => [e.id, e]));
    warnings = warn.mock.calls.map(args => String(args[0]));
    warn.mockRestore();
  });

  it('SUMMARY.md に載ったページを目次順に 1 ページ 1 エントリで取り込む', () => {
    expect(entries.map(e => e.id)).toEqual([
      'pasta:introduction',
      'pasta:getting-started/index',
      'pasta:grammar/markers',
      'pasta:lua/modules/index',
      'pasta:lua/modules/enc',
    ]);
    expect(warnings).toEqual([]);
  });

  it('パスの先頭要素からカテゴリを割り当てる（入れ子のページも先頭要素で決まる）', () => {
    expect(byId.get('pasta:introduction')?.category).toBe('pasta_startup');
    expect(byId.get('pasta:getting-started/index')?.category).toBe('pasta_startup');
    expect(byId.get('pasta:grammar/markers')?.category).toBe('pasta_grammar');
    expect(byId.get('pasta:lua/modules/enc')?.category).toBe('pasta_lua');
  });

  it('url は mdBook の HTML、rawUrl は main の生 Markdown を指す', () => {
    const entry = byId.get('pasta:grammar/markers');
    expect(entry?.source).toBe('pasta_docs');
    expect(entry?.title).toBe('キーワード・マーカー');
    expect(entry?.url).toBe('https://ekicyou.github.io/pasta/grammar/markers.html');
    expect(entry?.rawUrl).toBe('https://raw.githubusercontent.com/ekicyou/pasta/refs/heads/main/book/src/grammar/markers.md');
    expect(byId.get('pasta:introduction')?.url).toBe('https://ekicyou.github.io/pasta/introduction.html');
  });

  it('SUMMARY.md が無ければ submodule 初期化を促して失敗する', () => {
    expect(() => parsePastaDocs(resolve('tests/fixtures/no-such-dir'))).toThrow(/Pasta docs source not found[\s\S]*git submodule update/);
  });
});
