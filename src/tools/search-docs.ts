import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SearchEngine } from '../search/engine.js';
import { CATEGORIES } from '../constants.js';
import type { Category, Source } from '../types.js';

const SOURCE_VALUES = ['ukadoc', 'yaya_wiki', 'satori_wiki'] as const;
const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function registerSearchDocsTool(server: McpServer, engine: SearchEngine): void {
  server.tool(
    'search_docs',
    '伺か・YAYA・里々の技術ドキュメントをキーワード検索する。要約（500文字）を返す。詳細は get_doc で取得。',
    {
      query: z.string().min(1).describe('検索キーワード'),
      category: z.enum(CATEGORY_KEYS as [Category, ...Category[]]).optional()
        .describe('カテゴリで絞り込み（list_categories で確認可能）'),
      source: z.enum(SOURCE_VALUES).optional()
        .describe('ソースで絞り込み: ukadoc / yaya_wiki / satori_wiki'),
      limit: z.number().int().min(1).max(50).default(10)
        .describe('返却件数の上限（デフォルト10、最大50）'),
    },
    async ({ query, category, source, limit }) => {
      const { results, total } = engine.search(query, {
        category: category as Category | undefined,
        source: source as Source | undefined,
        limit,
      });

      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'not_found',
              message: `「${query}」に一致するドキュメントが見つかりませんでした。`,
              total: 0,
            }),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            total,
            showing: results.length,
            data: results,
          }, null, 2),
        }],
      };
    },
  );
}
