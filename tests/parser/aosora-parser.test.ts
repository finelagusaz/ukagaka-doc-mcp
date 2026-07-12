import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { markdownToPlainText, parseAosoraWiki } from '../../src/parser/aosora-parser.js';

describe('markdownToPlainText', () => {
  it('見出し記号を除去しテキストを保持する', () => {
    expect(markdownToPlainText('# タイトル\n\n## 節')).toBe('タイトル\n\n節');
  });

  it('リンクと画像をテキストに変換する', () => {
    expect(markdownToPlainText('[変数](04_04_変数)を参照。![図](img.png)'))
      .toBe('変数を参照。図');
  });

  it('強調記号を除去する', () => {
    expect(markdownToPlainText('**重要** と *注意* と _補足_')).toBe('重要 と 注意 と 補足');
  });

  it('コードフェンス内は無加工で保持しフェンス行を除去する', () => {
    const md = '説明\n```\ntalk = "**not emphasis**";\n# not heading\n```\n後続';
    expect(markdownToPlainText(md)).toBe('説明\ntalk = "**not emphasis**";\n# not heading\n後続');
  });

  it('~~~ フェンスも扱える', () => {
    const md = '~~~\nx * y\n~~~';
    expect(markdownToPlainText(md)).toBe('x * y');
  });

  it('inline code 内の記号を保護する', () => {
    expect(markdownToPlainText('`a * b` と `snake_case` は保持')).toBe('a * b と snake_case は保持');
  });

  it('テーブル行を | 区切りのまま保持する', () => {
    const md = '| 型 | 説明 |\n|---|---|\n| number | 数値 |';
    expect(markdownToPlainText(md)).toBe('| 型 | 説明 |\n|---|---|\n| number | 数値 |');
  });

  it('3行以上の連続空行を圧縮し前後の空白を除去する', () => {
    expect(markdownToPlainText('\n\na\n\n\n\nb\n\n')).toBe('a\n\nb');
  });
});

const fixtureDir = resolve('tests/fixtures/aosora');

describe('parseAosoraWiki', () => {
  const entries = parseAosoraWiki(fixtureDir);
  const byId = new Map(entries.map(e => [e.id, e]));

  it('目次ページ（00_）を除外する', () => {
    expect(entries.some(e => e.id.startsWith('aosora:00_'))).toBe(false);
    expect(entries).toHaveLength(4);
  });

  it('id はファイル stem 込みの安定形式', () => {
    expect(byId.has('aosora:04_04_変数')).toBe(true);
  });

  it('title は先頭 h1 見出しから取得する', () => {
    expect(byId.get('aosora:04_04_変数')?.title).toBe('変数');
  });

  it('h1 が無い場合はファイル名から番号を除いて整形する', () => {
    expect(byId.get('aosora:06_データ型')?.title).toBe('データ型');
  });

  it('url は encodeURIComponent した GitHub Wiki URL', () => {
    expect(byId.get('aosora:04_04_変数')?.url).toBe(
      'https://github.com/kanadelab/aosora-shiori/wiki/04_04_%E5%A4%89%E6%95%B0',
    );
  });

  it('第1階層番号でカテゴリ割当する', () => {
    expect(byId.get('aosora:04_04_変数')?.category).toBe('aosora_grammar');
    expect(byId.get('aosora:06_データ型')?.category).toBe('aosora_grammar');
    expect(byId.get('aosora:13_02_JsonSerializer')?.category).toBe('aosora_builtin');
  });

  it('未知番号は aosora_general に落ちる', () => {
    expect(byId.get('aosora:99_未知の章')?.category).toBe('aosora_general');
  });

  it('content は Markdown 記号が除去されコード内容は保持される', () => {
    const content = byId.get('aosora:04_04_変数')?.content ?? '';
    expect(content).toContain('ローカル変数');
    expect(content).not.toContain('**');
    expect(content).toContain('x = x * 2;');
    expect(content).toContain('snake_case');
  });

  it('source は aosora_wiki', () => {
    expect(entries.every(e => e.source === 'aosora_wiki')).toBe(true);
  });
});
