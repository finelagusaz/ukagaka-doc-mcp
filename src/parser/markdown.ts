/**
 * Markdown → プレーンテキスト変換（蒼空 Wiki / YAYA docs パーサー共用）
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

/** 1行分の inline Markdown 記法を除去する。inline code の中身は保護する。 */
function stripInlineMarkdown(line: string): string {
  // 表の行ではセル区切りと区別するため `|` が `\|` とエスケープされている（コードスパン内も）
  const unescaped = /^\s*\|/.test(line) ? line.replace(/\\\|/g, '|') : line;

  // inline code を NUL 区切りプレースホルダに退避
  const codeSpans: string[] = [];
  let text = unescaped.replace(/`([^`]*)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  text = text
    .replace(/^#{1,6}\s+/, '')                    // 見出し記号
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')     // 画像 → alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // リンク → テキスト
    .replace(/(\*\*|__)(.+?)\1/g, '$2')           // 強い強調
    .replace(/(\*|_)([^\s*_][^*_]*)\1/g, '$2');   // 強調

  // 退避した inline code を復元
  return text.replace(/\u0000(\d+)\u0000/g, (_match, i: string) => codeSpans[Number(i)]);
}
