import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SearchEngine } from '../search/engine.js';

export function registerGetDocTool(server: McpServer, engine: SearchEngine): void {
  server.tool(
    'get_doc',
    'search_docs で得た id を指定して、ドキュメントの全文を取得する。',
    {
      id: z.string().describe(
        'canonical_id（例: "yaya:マニュアル/関数/REPLACE", "satori:特殊記号一覧", "ukadoc:list_sakura_script:tag_s"）',
      ),
    },
    async ({ id }) => {
      const entry = engine.getById(id);

      if (!entry) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'not_found',
              message: `id "${id}" のドキュメントが見つかりませんでした。search_docs で正しい id を確認してください。`,
            }),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            data: entry,
          }, null, 2),
        }],
      };
    },
  );
}
