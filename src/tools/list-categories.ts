import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { CATEGORIES } from '../constants.js';
import type { Category } from '../types.js';

const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function registerListCategoriesTool(server: McpServer): void {
  server.registerTool(
    'list_categories',
    {
      description: 'カテゴリ ID・所属 source・ラベル（日本語の説明）の一覧を返す。ID は search_docs の category パラメータに渡す値で、'
        + 'ID の一覧自体は search_docs の category の選択肢にも列挙されている。ID の意味をラベルで確かめたいときに使う。',
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
