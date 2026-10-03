import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocEntry } from '../../src/types.js';
import { resolve } from 'node:path';
import { parsePastaDocs } from '../../src/parser/pasta-docs-parser.js';
import { mdBookHeadingId } from '../../src/parser/mdbook.js';

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

  it('SUMMARY.md に載ったページを目次順に、導入部と ## 見出しごとのエントリで取り込む', () => {
    expect(entries.map(e => e.id)).toEqual([
      'pasta:introduction',
      'pasta:getting-started/index',
      'pasta:grammar/markers',
      'pasta:grammar/markers:マーカー一覧',
      'pasta:grammar/markers:-単語参照',
      'pasta:grammar/markers:マーカー一覧-1',
      'pasta:lua/modules/index',
      'pasta:lua/modules/enc',
    ]);
  });

  it('口上の区切り（---）が無いページは警告してページ全体を残す', () => {
    expect(warnings).toEqual([
      '[pasta-docs-parser] Warning: framing rules (---) not found, kept whole page: lua/modules/index',
    ]);
    expect(byId.get('pasta:lua/modules/index')?.content).toBe('公開モジュール API\n\n一覧です。');
  });

  it('最初の --- より前（h1 は残す）と最後の --- より後の口上を本文から除く', () => {
    expect(byId.get('pasta:introduction')?.content).toBe('はじめに\n\nPasta は伺か用の SHIORI です。');
    expect(byId.get('pasta:grammar/markers')?.content).toBe('キーワード・マーカー\n\nマーカーは行の種類を決める記号である。');
    expect(byId.get('pasta:grammar/markers:マーカー一覧-1')?.content).toBe('マーカー一覧\n\n同じ見出しが二度目に出た節。');
  });

  it('## 節は「ページ名 - 見出し」の title とアンカー付き url を持ち、### とコード内の ## / --- は節に含める', () => {
    const section = byId.get('pasta:grammar/markers:マーカー一覧');
    expect(section?.title).toBe('キーワード・マーカー - マーカー一覧');
    expect(section?.url).toBe('https://ekicyou.github.io/pasta/grammar/markers.html#マーカー一覧');
    expect(section?.rawUrl).toBe('https://raw.githubusercontent.com/ekicyou/pasta/refs/heads/main/book/src/grammar/markers.md');
    expect(section?.content).toContain('識別子（Identifier）');
    expect(section?.content).toContain('## これは見出しではない\n---');
    expect(byId.get('pasta:grammar/markers:-単語参照')?.title).toBe('キーワード・マーカー - @ 単語参照（＠）');
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

  it('見出しの id は mdBook と同じ規則で作る（上流の目次リンクと描画済みサイトで確認した例）', () => {
    expect(mdBookHeadingId('予約グローバル変数（pasta_ で始まる名前）')).toBe('予約グローバル変数pasta_-で始まる名前');
    expect(mdBookHeadingId('[actor]（名前・アクター設定）')).toBe('actor名前アクター設定');
    expect(mdBookHeadingId('break_lines(text, widths)')).toBe('break_linestext-widths');
    expect(mdBookHeadingId('DSL と Lua の対応表')).toBe('dsl-と-lua-の対応表');
    expect(mdBookHeadingId('1. モジュール検索パス')).toBe('1-モジュール検索パス');
  });

  it('SUMMARY.md が無ければ submodule 初期化を促して失敗する', () => {
    expect(() => parsePastaDocs(resolve('tests/fixtures/no-such-dir'))).toThrow(/Pasta docs source not found[\s\S]*git submodule update/);
  });
});
