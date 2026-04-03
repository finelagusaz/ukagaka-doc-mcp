import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CATEGORIES } from '../constants.js';
import type { Category } from '../types.js';

const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function registerListCategoriesTool(server: McpServer): void {
  server.tool(
    'list_categories',
    '検索に使えるカテゴリ一覧を返す。search_docs の category パラメータに使用する。',
    {},
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
