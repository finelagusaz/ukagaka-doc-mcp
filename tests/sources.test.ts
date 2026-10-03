import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOURCES, SOURCE_VALUES } from '../src/constants.js';
import { SEARCH_DOCS_DESCRIPTION } from '../src/tools/search-docs.js';

// ソース定義は constants.ts の SOURCES に一元化している。コードから組み立てられない箇所をここで見張る
describe('SOURCES', () => {
  it('search_docs の description は 1024 文字以下（OpenAI 系クライアントが超過を 400 で弾く）', () => {
    expect(SEARCH_DOCS_DESCRIPTION.length).toBeLessThanOrEqual(1024);
  });

  it('README の「検索対象」表に全ソースが1行ずつ載っている', () => {
    const readme = readFileSync('README.md', 'utf-8');
    const section = readme.split(/^## 検索対象$/m)[1]?.split(/^## /m)[0] ?? '';
    const rows = section.split('\n')
      .filter(line => line.startsWith('|') && !/^\|\s*(ソース|-+)\s*\|/.test(line))
      .map(line => line.split('|')[1].replace(/\s/g, ''));

    expect(rows).toHaveLength(SOURCE_VALUES.length);
    for (const { shortName } of Object.values(SOURCES)) {
      expect(rows.some(row => row.startsWith(shortName.replace(/\s/g, ''))), shortName).toBe(true);
    }
  });
});
