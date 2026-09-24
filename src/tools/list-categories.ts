import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { CATEGORIES } from '../constants.js';
import type { Category } from '../types.js';

const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function registerListCategoriesTool(server: McpServer): void {
  server.registerTool(
    'list_categories',
    {
      description: '検索に使えるカテゴリ一覧を返す。search_docs の category パラメータに使用する。',
      inputSchema: z.object({}),
    },
    async () => {
      const categories = CATEGORY_KEYS.map(id => ({
        id,
        source: CATEGORIES[id].source,
        label: CATEGORIES[id].label,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            data: categories,
          }, null, 2),
        }],
      };
    },
  );
}
