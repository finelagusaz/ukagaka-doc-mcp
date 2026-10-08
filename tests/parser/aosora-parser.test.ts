import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { markdownToPlainText } from '../../src/parser/markdown.js';
import { parseAosoraWiki } from '../../src/parser/aosora-parser.js';

describe('markdownToPlainText', () => {
  it('見出し記号を除去しテキストを保持する', () => {
    expect(markdownToPlainText('# タイトル\n\n## 節')).toBe('タイトル\n\n節');
  });

  it('リンクと画像をテキストに変換する', () => {
    expect(markdownToPlainText('[変数](04_04_変数)を参照。![図](img.png)'))
      .toBe('変数を参照。図');
  });

  it('リンクテキスト・alt 内の対になった [] を保持して変換する', () => {
    expect(markdownToPlainText('- [[psl] ASCIIコード一覧表](http://example.com/a)'))
      .toBe('- [psl] ASCIIコード一覧表');
    expect(markdownToPlainText('![図 [1]](img.png)')).toBe('図 [1]');
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

  it('admonition の見出し行はタイトルだけ残し、本文は保持する', () => {
    expect(markdownToPlainText('!!! warning "式の中の `（`"\n    本文')).toBe('式の中の （\n    本文');
    expect(markdownToPlainText('前文\n!!! note\n    本文')).toBe('前文\n\n    本文');
  });

  it('単語の途中の _ は強調とみなさない', () => {
    expect(markdownToPlainText('APPEND_RUNTIME_DIC を使う')).toBe('APPEND_RUNTIME_DIC を使う');
    expect(markdownToPlainText('RE_GETSTR、RE_GETPOS で取得')).toBe('RE_GETSTR、RE_GETPOS で取得');
    expect(markdownToPlainText('"_RUNTIME_DIC_" という辞書')).toBe('"_RUNTIME_DIC_" という辞書');
  });

  it('単語の途中でも * は強調とみなす', () => {
    expect(markdownToPlainText('foo*bar*baz')).toBe('foobarbaz');
  });

  it('バックスラッシュエスケープを外す', () => {
    expect(markdownToPlainText('## \\_\\_AYA\\_SYSTEM\\_FILE\\_\\_')).toBe('__AYA_SYSTEM_FILE__');
    expect(markdownToPlainText('\\*強調ではない\\*')).toBe('*強調ではない*');
  });

  it('コードスパン内のバックスラッシュは文字どおり保持する', () => {
    expect(markdownToPlainText('`"saori\\\\xxx.dll"` は不可')).toBe('"saori\\\\xxx.dll" は不可');
  });

  it('エスケープしたバッククォートはコードスパンを開かない', () => {
    expect(markdownToPlainText('\\`_x_\\` と `_a_`')).toBe('`x` と _a_');
  });

  it('複数バッククォートのコードスパンを扱う', () => {
    expect(markdownToPlainText('``a`b`` と **強調**')).toBe('a`b と 強調');
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

  it('rawUrl は manual/ を含む raw.githubusercontent.com の Wiki URL', () => {
    expect(byId.get('aosora:04_04_変数')?.rawUrl).toBe(
      'https://raw.githubusercontent.com/wiki/kanadelab/aosora-shiori/manual/04_04_%E5%A4%89%E6%95%B0.md',
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
