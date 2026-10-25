import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocEntry } from '../../src/types.js';
import { resolve } from 'node:path';
import { parseKawariDocs } from '../../src/parser/kawari-docs-parser.js';

const fixtureDir = resolve('tests/fixtures/kawari-docs');

describe('parseKawariDocs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let entries: DocEntry[];
  let byId: Map<string, DocEntry>;

  beforeAll(() => {
    // 未知ディレクトリの警告は専用テストで検証する
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    entries = parseKawariDocs(fixtureDir);
    byId = new Map(entries.map(e => [e.id, e]));
    warn.mockRestore();
  });

  it('既知ディレクトリのページだけを 1 ページ 1 エントリで取り込む（直下の INDEX.md は除く）', () => {
    expect([...byId.keys()].sort()).toEqual([
      'kawari:grammar/02-entry-definition',
      'kawari:kis/if',
      'kawari:kis/index',
    ]);
    expect(entries.some(e => e.content.includes('目次'))).toBe(false);
  });

  it('ディレクトリからカテゴリを割り当てる', () => {
    expect(byId.get('kawari:kis/if')?.category).toBe('kawari_kis');
    expect(byId.get('kawari:kis/index')?.category).toBe('kawari_kis');
    expect(byId.get('kawari:grammar/02-entry-definition')?.category).toBe('kawari_grammar');
  });

  it('url は元ファイルの URL（上流がまとめたページへ転送する）、rawUrl は生 Markdown を指す', () => {
    const entry = byId.get('kawari:kis/if');
    expect(entry?.source).toBe('kawari_docs');
    expect(entry?.title).toBe('if');
    expect(entry?.url).toBe('https://ukatech.shillest.net/kawari-docs/kis/if/');
    expect(entry?.rawUrl).toBe('https://raw.githubusercontent.com/ukatech/kawari-docs/refs/heads/main/kis/if.md');
  });

  it('ディレクトリの index.md はディレクトリ URL で配信される', () => {
    const entry = byId.get('kawari:kis/index');
    expect(entry?.title).toBe('KIS リファレンス');
    expect(entry?.url).toBe('https://ukatech.shillest.net/kawari-docs/kis/');
    expect(entry?.rawUrl).toBe('https://raw.githubusercontent.com/ukatech/kawari-docs/refs/heads/main/kis/index.md');
  });

  it('本文はプレーンテキスト化する', () => {
    const content = byId.get('kawari:kis/if')?.content ?? '';
    expect(content).toContain('$(if 条件文 真の場合の文 else 偽の場合の文)');
    expect(content).toContain('else if節は何段でもつなげる事ができる。');
    expect(content).not.toContain('**');
  });

  it('未知のディレクトリは警告してスキップし、assets・scripts・overrides は黙って除外する', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = parseKawariDocs(fixtureDir);
    expect(result.some(e => e.id.startsWith('kawari:unknown-dir/'))).toBe(false);
    expect(result.some(e => e.id.startsWith('kawari:scripts/'))).toBe(false);
    expect(result.some(e => e.id.startsWith('kawari:overrides/'))).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown-dir'));
    for (const dir of ['assets', 'scripts', 'overrides']) {
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining(dir));
    }
  });

  it('ディレクトリが無ければ submodule 初期化を促して失敗する', () => {
    expect(() => parseKawariDocs(resolve('tests/fixtures/no-such-dir'))).toThrow(/git submodule update/);
  });
});
