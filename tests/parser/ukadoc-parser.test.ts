import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import type { DocEntry } from '../../src/types.js';
import { parseUkadoc } from '../../src/parser/ukadoc-parser.js';

const fixtureDir = resolve('tests/fixtures/ukadoc-spec');
const SITE = 'https://ukatech.shillest.net/ukadoc-spec/';
const RAW = 'https://raw.githubusercontent.com/ukatech/ukadoc-spec/refs/heads/main/';

describe('parseUkadoc', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  let entries: DocEntry[];
  let byId: Map<string, DocEntry>;

  beforeAll(() => {
    // 未知のページ・ディレクトリの警告は専用テストで検証する
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    entries = parseUkadoc(fixtureDir);
    byId = new Map(entries.map(e => [e.id, e]));
    warn.mockRestore();
  });

  it('1 ファイル 1 エントリで取り込み、目次だけの index.md・直下のファイル・非本文ディレクトリは除く', () => {
    expect([...byId.keys()].sort()).toEqual([
      'ukadoc:descript/ghost/descript-txt/charset',
      'ukadoc:descript/shell/descript-txt/charset',
      'ukadoc:list/shiori-event/boot/OnBoot',
      'ukadoc:list/shiori-event/index',
      'ukadoc:list/shiori-event/other/OnClose',
      'ukadoc:list/shiori-event/other/boot',
      'ukadoc:manual/ghost',
      'ukadoc:memo/memo',
      'ukadoc:memo/shiori-event',
      'ukadoc:spec/plugin',
      'ukadoc:spec/sstp/sstp',
    ]);
  });

  it('ページからカテゴリを割り当てる（memo/shiori-event は個別の指定が優先）', () => {
    expect(byId.get('ukadoc:list/shiori-event/boot/OnBoot')?.category).toBe('shiori_event');
    expect(byId.get('ukadoc:descript/ghost/descript-txt/charset')?.category).toBe('descript');
    expect(byId.get('ukadoc:spec/sstp/sstp')?.category).toBe('protocol');
    expect(byId.get('ukadoc:spec/plugin')?.category).toBe('protocol');
    expect(byId.get('ukadoc:manual/ghost')?.category).toBe('file_structure');
    expect(byId.get('ukadoc:memo/shiori-event')?.category).toBe('shiori_event');
    expect(byId.get('ukadoc:memo/memo')?.category).toBe('dev_guide');
  });

  it('まとめて配信されるページの項目は、ページの URL と項目のアンカーを指す', () => {
    const entry = byId.get('ukadoc:list/shiori-event/boot/OnBoot');
    expect(entry?.source).toBe('ukadoc');
    expect(entry?.title).toBe('OnBoot');
    expect(entry?.url).toBe(`${SITE}list/shiori-event/#OnBoot`);
    expect(entry?.rawUrl).toBe(`${RAW}list/shiori-event/boot/OnBoot.md`);
    // ページ自身の index.md はアンカーなし
    expect(byId.get('ukadoc:list/shiori-event/index')?.url).toBe(`${SITE}list/shiori-event/`);
  });

  it('ページ内でアンカーが重なる項目は、ページからのパスを - でつなぐ（上流 prepare_site.py と同じ規則）', () => {
    // boot/index.md（取り込まないが採番には数える）と other/boot.md が重なる
    expect(byId.get('ukadoc:list/shiori-event/other/boot')?.url).toBe(`${SITE}list/shiori-event/#other-boot`);
    // ページ自身の index.md（sstp）と sstp.md が重なる。ページ自身は sstp-page に退く
    expect(byId.get('ukadoc:spec/sstp/sstp')?.url).toBe(`${SITE}spec/sstp/#sstp`);
  });

  it('1 ファイル 1 ページのものは、そのページの URL を指す', () => {
    expect(byId.get('ukadoc:manual/ghost')?.url).toBe(`${SITE}manual/ghost/`);
    expect(byId.get('ukadoc:spec/plugin')?.url).toBe(`${SITE}spec/plugin/`);
    expect(byId.get('ukadoc:spec/plugin')?.rawUrl).toBe(`${RAW}spec/plugin.md`);
  });

  it('カテゴリ行の代わりに祖先の index.md の H1 をパンくずとして先頭に置き、同じ名前の項目を見分けられる', () => {
    const ghost = byId.get('ukadoc:descript/ghost/descript-txt/charset');
    const shell = byId.get('ukadoc:descript/shell/descript-txt/charset');
    expect(ghost?.title).toBe('charset,文字コード');
    expect(ghost?.content).toMatch(/^\[Ghost設定 > descript\.txt\]\ncharset,文字コード\n/);
    expect(shell?.content).toMatch(/^\[Shell設定 > descript\.txt\]\n/);
    expect(ghost?.content).not.toContain('カテゴリ:');
    expect(ghost?.url).toBe(`${SITE}descript/ghost/#charset`);
  });

  it('index.md は「## 一覧」を除いた本文を取り込み、パンくずに自身の H1 は含めない', () => {
    const content = byId.get('ukadoc:list/shiori-event/index')?.content ?? '';
    expect(content).toBe('SHIORI Eventリスト\n\nイベントの一覧。');
  });

  it('本文はプレーンテキスト化する（<br />・リンク・強調・admonition・文字実体参照）', () => {
    const onBoot = byId.get('ukadoc:list/shiori-event/boot/OnBoot')?.content ?? '';
    expect(onBoot).toContain('起動した際に発生。\nOnCloseと対になる。');
    expect(onBoot).toContain('- Reference0: シェル名。');
    expect(onBoot).toContain('対応: SSP / CROW');
    const onClose = byId.get('ukadoc:list/shiori-event/other/OnClose')?.content ?? '';
    expect(onClose).toContain('非推奨');
    expect(onClose).toContain('終了時に発生。a &lt; b と <tag>。');
  });

  it('未知のページ・ディレクトリは警告を出してスキップする', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    parseUkadoc(fixtureDir);
    const messages = warn.mock.calls.map(args => String(args[0]));
    expect(messages).toContain('[ukadoc-parser] Warning: unknown page, skipped: list/unknown-page');
    expect(messages).toContain('[ukadoc-parser] Warning: unknown directory, skipped: unknown-dir');
    expect(messages).toHaveLength(2);
  });

  it('ディレクトリが無ければ submodule の初期化を促すエラーにする', () => {
    expect(() => parseUkadoc(resolve('tests/fixtures/__missing__'))).toThrow(/git submodule update/);
  });
});
