import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { MAX_ID_LENGTH, SOURCES } from '../constants.js';
import type { SearchEngine } from '../search/engine.js';

export function registerGetDocTool(server: McpServer, engine: SearchEngine): void {
  server.registerTool(
    'get_doc',
    {
      description: 'search_docs の結果にある id を指定して、ドキュメント1件の全文（content）と title・source・category・url を返す。'
        + 'UKADOC・SSP ヘルプ以外（元のソースが Markdown）は、元の Markdown を取得できる rawUrl も返す。'
        + 'search_docs の summary は本文の冒頭で切れているので、続きや詳細を確かめるときに使う。'
        + 'id の形式はソースごとに異なり、search_docs の結果の id がそのまま使える。存在しない id には status: "not_found" を返す。',
      inputSchema: z.object({
        id: z.string().max(MAX_ID_LENGTH).describe(
          `canonical_id（例: ${Object.values(SOURCES).map(s => `"${s.exampleId}"`).join(', ')}）`,
        ),
      }),
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
