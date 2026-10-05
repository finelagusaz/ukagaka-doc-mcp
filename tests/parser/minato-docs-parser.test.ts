import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocEntry } from '../../src/types.js';
import { resolve } from 'node:path';
import { parseMinatoDocs, parseSummary } from '../../src/parser/minato-docs-parser.js';

const fixtureDir = resolve('tests/fixtures/minato-docs');

describe('parseSummary', () => {
  it('前付け・入れ子のリンクを出現順に拾い、下書き章・区切り・見出しは無視する（CRLF 可）', () => {
    const summary = '# 本\r\n\r\n[はじめに](README.md)\r\n\r\n- [章](a/index.md)\r\n  - [節](./a/b.md)\r\n  - [下書き]()\r\n\r\n---\r\n\r\n# 付録\r\n\r\n- [付録A](c.md)\r\n';
    expect(parseSummary(summary)).toEqual([
      { path: 'README', label: 'はじめに' },
      { path: 'a/index', label: '章' },
      { path: 'a/b', label: '節' },
      { path: 'c', label: '付録A' },
    ]);
  });
});

describe('parseMinatoDocs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let entries: DocEntry[];
  let byId: Map<string, DocEntry>;
  let warnings: string[];

  beforeAll(() => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    entries = parseMinatoDocs(fixtureDir);
    byId = new Map(entries.map(e => [e.id, e]));
    warnings = warn.mock.calls.map(args => String(args[0]));
    warn.mockRestore();
  });

  it('SUMMARY.md に載ったページだけを目次順に 1 ページ 1 エントリで取り込む', () => {
    expect(entries.map(e => e.id)).toEqual([
      'minato:README',
      'minato:intro/what_is_minato',
      'minato:basic/files',
      'minato:func/index',
      'minato:func/builtin',
      'minato:include',
      'minato:migration/index',
    ]);
  });

  it('パスの先頭要素からカテゴリを割り当てる（直下のファイルはファイル名）', () => {
    expect(byId.get('minato:README')?.category).toBe('minato_startup');
    expect(byId.get('minato:intro/what_is_minato')?.category).toBe('minato_startup');
    expect(byId.get('minato:basic/files')?.category).toBe('minato_basic');
    expect(byId.get('minato:func/builtin')?.category).toBe('minato_grammar');
    expect(byId.get('minato:include')?.category).toBe('minato_grammar');
    expect(byId.get('minato:migration/index')?.category).toBe('minato_migration');
  });

  it('url は mdBook の HTML、rawUrl は master の生 Markdown を指す', () => {
    const entry = byId.get('minato:func/builtin');
    expect(entry?.source).toBe('minato_docs');
    expect(entry?.url).toBe('https://mizuki-yura.github.io/minato/func/builtin.html');
    expect(entry?.rawUrl).toBe('https://raw.githubusercontent.com/mizuki-yura/minato/refs/heads/master/docs/src/func/builtin.md');
  });

  it('README.md は index.html として配信される', () => {
    const entry = byId.get('minato:README');
    expect(entry?.url).toBe('https://mizuki-yura.github.io/minato/index.html');
    expect(entry?.rawUrl).toBe('https://raw.githubusercontent.com/mizuki-yura/minato/refs/heads/master/docs/src/README.md');
  });

  it('title は先頭 h1（先頭の空行は読み飛ばす）、無ければ目次の表示名', () => {
    expect(byId.get('minato:intro/what_is_minato')?.title).toBe('湊とは');
    expect(byId.get('minato:include')?.title).toBe('include');
    expect(byId.get('minato:README')?.title).toBe('湊ドキュメント');
  });

  it('本文は Markdown 記法を除いたプレーンテキストで、コードは保持する', () => {
    const content = byId.get('minato:func/builtin')?.content ?? '';
    expect(content).toContain('random\n\nlet n = random(10)');
    expect(content).toContain('| len(s) | 文字数 |');
  });

  it('未知の章・目次に無いページ・目次にあるが存在しないページを警告する（SUMMARY.md 自身は除く）', () => {
    expect(byId.has('minato:newsection/page')).toBe(false);
    // Object.prototype のプロパティ名もカテゴリ表に無い章として扱う
    expect(byId.has('minato:constructor/page')).toBe(false);
    expect(byId.has('minato:func/unlisted')).toBe(false);
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('unknown section, skipped: newsection/page'),
      expect.stringContaining('unknown section, skipped: constructor/page'),
      expect.stringContaining('page not in SUMMARY.md, skipped: func/unlisted'),
      expect.stringContaining('page listed in SUMMARY.md not found: func/missing'),
    ]));
    expect(warnings.some(w => w.endsWith(': SUMMARY'))).toBe(false);
  });

  it('SUMMARY.md が無ければ submodule 初期化を促して失敗する', () => {
    expect(() => parseMinatoDocs(resolve('tests/fixtures/no-such-dir'))).toThrow(/git submodule update/);
  });
});
