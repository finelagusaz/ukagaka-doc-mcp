import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocEntry } from '../../src/types.js';
import { resolve } from 'node:path';
import { parseSspHelp } from '../../src/parser/ssphelp-parser.js';

const fixtureDir = resolve('tests/fixtures/ssphelp');

describe('parseSspHelp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let entries: DocEntry[];
  let byId: Map<string, DocEntry>;

  beforeAll(() => {
    // 未知ディレクトリの警告は専用テストで検証する
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    entries = parseSspHelp(fixtureDir);
    byId = new Map(entries.map(e => [e.id, e]));
    warn.mockRestore();
  });

  it('直下の INDEX.md と既知ディレクトリのページを 1 ページ 1 エントリで取り込む（README.md は除く）', () => {
    expect([...byId.keys()].sort()).toEqual([
      'ssphelp:config/ghost',
      'ssphelp:functions/calendar/index',
      'ssphelp:functions/calendar/menu',
      'ssphelp:index',
    ]);
    expect(entries.some(e => e.content.includes('リポジトリの説明'))).toBe(false);
  });

  it('先頭のディレクトリからカテゴリを割り当て、INDEX.md は基本的な使い方に入れる', () => {
    expect(byId.get('ssphelp:index')?.category).toBe('ssp_usage');
    expect(byId.get('ssphelp:config/ghost')?.category).toBe('ssp_config');
    expect(byId.get('ssphelp:functions/calendar/menu')?.category).toBe('ssp_feature');
  });

  it('url は新しいサイトのページ、rawUrl は生 Markdown を指す', () => {
    const entry = byId.get('ssphelp:config/ghost');
    expect(entry?.source).toBe('ssp_help');
    expect(entry?.title).toBe('設定：ゴースト(1)');
    expect(entry?.url).toBe('https://ukatech.shillest.net/ukadoc-ssp/config/ghost/');
    expect(entry?.rawUrl).toBe('https://raw.githubusercontent.com/ukatech/ukadoc-ssp/refs/heads/main/config/ghost.md');
  });

  it('入れ子のディレクトリの index.md はディレクトリ URL、直下の INDEX.md はサイトのルートで配信される', () => {
    expect(byId.get('ssphelp:functions/calendar/index')?.url).toBe('https://ukatech.shillest.net/ukadoc-ssp/functions/calendar/');
    expect(byId.get('ssphelp:functions/calendar/menu')?.url).toBe('https://ukatech.shillest.net/ukadoc-ssp/functions/calendar/menu/');
    const index = byId.get('ssphelp:index');
    expect(index?.title).toBe('はじめに');
    expect(index?.url).toBe('https://ukatech.shillest.net/ukadoc-ssp/');
    expect(index?.rawUrl).toBe('https://raw.githubusercontent.com/ukatech/ukadoc-ssp/refs/heads/main/INDEX.md');
  });

  it('本文はプレーンテキスト化する（画像は alt、<br> と強調は外す）', () => {
    expect(byId.get('ssphelp:index')?.content).toMatch(/^SSP\n\nはじめに/);
    const content = byId.get('ssphelp:config/ghost')?.content ?? '';
    expect(content).toContain('ゴーストを1つランダムに選択して起動（前回終了時の状態は破棄）\n  起動時にゴーストを1つランダムに起動します。');
    expect(content).not.toMatch(/<br|\*\*/);
  });

  it('未知のディレクトリは警告してスキップし、assets・materials は黙って除外する', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = parseSspHelp(fixtureDir);
    expect(result.some(e => e.id.startsWith('ssphelp:unknown-dir/'))).toBe(false);
    expect(result.some(e => e.id.startsWith('ssphelp:materials/'))).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown-dir'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('assets'));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('materials'));
  });

  it('ディレクトリが無ければ submodule 初期化を促して失敗する', () => {
    expect(() => parseSspHelp(resolve('tests/fixtures/no-such-dir'))).toThrow(/git submodule update/);
  });
});
