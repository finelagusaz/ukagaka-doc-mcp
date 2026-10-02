/**
 * Markdown → プレーンテキスト変換（蒼空 Wiki / YAYA docs / 里々 docs パーサー共用）
 */

/**
 * Markdown をプレーンテキストに変換する。
 * fenced code / inline code の中身は無加工で保持する。
 */
export function markdownToPlainText(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let fenceMarker: '```' | '~~~' | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      const marker = fenceMatch[1] as '```' | '~~~';
      if (fenceMarker === null) {
        fenceMarker = marker; // フェンス開始行は出力しない
      } else if (fenceMarker === marker) {
        fenceMarker = null; // フェンス終了行も出力しない
      } else {
        out.push(line); // フェンス内の別種マーカーはコードとして保持
      }
      continue;
    }

    if (fenceMarker !== null) {
      out.push(line); // コードフェンス内は無加工
      continue;
    }

    out.push(stripInlineMarkdown(line));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** バックスラッシュでエスケープできる ASCII 記号（CommonMark の定義） */
const ESCAPABLE = /[!-/:-@[-`{-~]/;

/**
 * inline code とバックスラッシュエスケープを NUL 区切りプレースホルダに退避する。
 * 両者は互いに影響する（`\`` はコードスパンを開かず、コードスパン内の `\` は文字どおり）ため、
 * 行頭から一度だけ走査して先に現れた方を採る。
 */
function protectLiterals(line: string): { text: string; literals: string[] } {
  const literals: string[] = [];
  const hold = (literal: string) => {
    literals.push(literal);
    return `\u0000${literals.length - 1}\u0000`;
  };

  let text = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];

    if (ch === '\\' && i + 1 < line.length && ESCAPABLE.test(line[i + 1])) {
      text += hold(line[i + 1]);
      i += 2;
      continue;
    }

    if (ch === '`') {
      let run = 1;
      while (line[i + run] === '`') run++;
      const fence = '`'.repeat(run);
      // 同じ長さのバッククォート列で閉じる（長さ違いの列は中身として扱う）
      let close = line.indexOf(fence, i + run);
      while (close !== -1 && line[close + run] === '`') {
        let end = close;
        while (line[end] === '`') end++;
        close = line.indexOf(fence, end);
      }
      if (close === -1) {
        text += fence; // 閉じないバッククォートは文字どおり
        i += run;
        continue;
      }
      const code = line.slice(i + run, close);
      // 両端が空白なら1文字ずつ落とす（`` ` `` でバッククォート自体を書くための CommonMark の規則）
      const trimmed = /^ .*[^ ].* $/.test(code) ? code.slice(1, -1) : code;
      text += hold(trimmed);
      i = close + run;
      continue;
    }

    text += ch;
    i++;
  }

  return { text, literals };
}

/** 1行分の inline Markdown 記法を除去する。inline code の中身とエスケープした記号は保護する。 */
function stripInlineMarkdown(line: string): string {
  // 表の行ではセル区切りと区別するため `|` が `\|` とエスケープされている（コードスパン内も）
  const unescaped = /^\s*\|/.test(line) ? line.replace(/\\\|/g, '|') : line;

  const { text: protectedText, literals } = protectLiterals(unescaped);

  const text = protectedText
    .replace(/^!!!\s+\w+(?:\s+"(.*)")?\s*$/, '$1') // admonition（!!! note "タイトル"）→ タイトル
    .replace(/^#{1,6}\s+/, '')                    // 見出し記号
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')     // 画像 → alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // リンク → テキスト
    .replace(/\*\*(.+?)\*\*/g, '$1')              // 強い強調
    .replace(/\*([^\s*][^*]*)\*/g, '$1')          // 強調
    // `_` は CommonMark 同様に単語の途中では強調にしない（APPEND_RUNTIME_DIC や snake_case を保つ）
    .replace(/(?<![\p{L}\p{N}_])__(.+?)__(?![\p{L}\p{N}_])/gu, '$1')
    .replace(/(?<![\p{L}\p{N}_])_([^\s_](?:[^_]*[^\s_])?)_(?![\p{L}\p{N}_])/gu, '$1');

  // 退避した inline code・エスケープ記号を復元
  return text.replace(/\u0000(\d+)\u0000/g, (_match, i: string) => literals[Number(i)]);
}
