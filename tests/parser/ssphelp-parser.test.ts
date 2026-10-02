import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocEntry } from '../../src/types.js';
import { resolve } from 'node:path';
import { parseSspHelp, parseToc } from '../../src/parser/ssphelp-parser.js';

const fixtureDir = resolve('tests/fixtures/ssphelp');

describe('parseToc', () => {
  it('入れ子の place を最上位項目に対応づける（CRLF 可）', () => {
    const yaml = '- title: 設定\r\n  place: config\r\n  children: \r\n    - title: 本体設定\r\n      children: \r\n        - title: 一般\r\n          place: config-ippan\r\n- title: 情報\r\n  place: information\r\n';
    expect(parseToc(yaml)).toEqual([
      { place: 'config', section: '設定' },
      { place: 'config-ippan', section: '設定' },
      { place: 'information', section: '情報' },
    ]);
  });
});

describe('parseSspHelp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let entries: DocEntry[];
  let byId: Map<string, DocEntry>;
  let warnings: string[];

  beforeAll(() => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    entries = parseSspHelp(fixtureDir);
    byId = new Map(entries.map(e => [e.id, e]));
    warnings = warn.mock.calls.map(args => String(args[0]));
    warn.mockRestore();
  });

  it('目次にあるページだけを 1 ページ 1 エントリで目次順に取り込む', () => {
    expect(entries.map(e => e.id)).toEqual([
      'ssphelp:index',
      'ssphelp:config',
      'ssphelp:config-ghost',
      'ssphelp:dev',
    ]);
  });

  it('目次の最上位項目からカテゴリを割り当てる（入れ子のページも最上位に従う）', () => {
    expect(byId.get('ssphelp:index')?.category).toBe('ssp_usage');
    expect(byId.get('ssphelp:config')?.category).toBe('ssp_config');
    expect(byId.get('ssphelp:config-ghost')?.category).toBe('ssp_config');
    expect(byId.get('ssphelp:dev')?.category).toBe('ssp_dev');
  });

  it('source と url は公開サイトのページを指し、rawUrl は持たない', () => {
    const entry = byId.get('ssphelp:config-ghost');
    expect(entry?.source).toBe('ssp_help');
    expect(entry?.url).toBe('https://ssp.shillest.net/ukadoc/ssphelp/config-ghost.html');
    expect(entry?.rawUrl).toBeUndefined();
  });

  it('title は先頭 h1、無ければ place', () => {
    expect(byId.get('ssphelp:config-ghost')?.title).toBe('設定：ゴースト(1)');
    expect(byId.get('ssphelp:dev')?.title).toBe('dev');
  });

  it('ソース上の改行は潰し、br とブロック要素で改行する', () => {
    expect(byId.get('ssphelp:index')?.content).toBe('はじめに\n\nSSP の ヘルプです。\n二行目。');
    const content = byId.get('ssphelp:config-ghost')?.content ?? '';
    expect(content).toContain('最小化時に喋らない\n\nゴーストをアイコン化するときに一切喋りません。');
  });

  it('表は行ごとにセルを | で区切り、行の間に空行を挟まない', () => {
    expect(byId.get('ssphelp:dev')?.content).toBe(
      '見出しのないページ。\n\n| 機能 | ショートカット |\n| カレンダー | Ctrl - D |\n| 開発用パレット | Ctrl - Shift - D |\n\n表のあと。',
    );
  });

  it('未知の最上位項目・目次に無い原稿・原稿の無いページを警告する（空の原稿は黙って除外）', () => {
    expect(byId.has('ssphelp:new-section')).toBe(false);
    expect(byId.has('ssphelp:unlisted')).toBe(false);
    expect(byId.has('ssphelp:disclaimer')).toBe(false);
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('unknown section in index.yaml, skipped: 新しい区分'),
      expect.stringContaining('page not in index.yaml, skipped: unlisted'),
      expect.stringContaining('page listed in index.yaml not found: missing-page'),
    ]));
    expect(warnings.some(w => w.includes('disclaimer'))).toBe(false);
  });

  it('原稿が無ければ submodule 初期化を促して失敗する', () => {
    expect(() => parseSspHelp(resolve('tests/fixtures/no-such-dir'))).toThrow(/git submodule update/);
  });
});
