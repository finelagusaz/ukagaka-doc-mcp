import { describe, expect, it } from 'vitest';
import { markdownToPlainText } from '../../src/parser/aosora-parser.js';

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
