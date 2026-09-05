import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SearchEngine } from '../search/engine.js';
import { CATEGORIES, SOURCE_VALUES } from '../constants.js';
import type { Category, Source } from '../types.js';

const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function registerSearchDocsTool(server: McpServer, engine: SearchEngine): void {
  // NOTE: ツール description は OpenAI 系クライアント（MCP→function calling ブリッジ）で
  // 1024文字を超えると 400 で弾かれる。詳しい指定スタイルは query の describe 側に置くこと
  // （パラメータの description には同様の上限が観測されていない）。
  server.tool(
    'search_docs',
    '伺か・YAYA・里々・蒼空の技術ドキュメントをキーワード検索する。要約（500文字）を返す。詳細は get_doc で取得。'
      + 'query は単語1つのみ（空白区切りや自然文は0件になる）。',
    {
      query: z.string().min(1).describe(
        `検索語。クエリ全体を1個の部分文字列として照合する単純検索（部分一致/大小無視）。分かち書き・AND/OR無し。
OK: "OnBoot" "選択肢" "REPLACE" "\\q" "surfaces.txt" ／ NG: "文字列 置換" "さくらスクリプトで選択肢を出す方法" "choice"
- 識別子・タグは原文表記のまま（さくらスクリプトは "\\q" のようにバックスラッシュ付き）
- 日本語で引き、助詞や修飾は落として名詞の核だけにする（"変数のスコープ"→"スコープ"）
- 絞り込みは語を足さず category / source を使う。0件なら短い語に分解して引き直す`,
      ),
      category: z.enum(CATEGORY_KEYS as [Category, ...Category[]]).optional()
        .describe('カテゴリで絞り込み（list_categories で確認可能）'),
      source: z.enum(SOURCE_VALUES).optional()
        .describe('ソースで絞り込み: ukadoc / yaya_wiki / satori_wiki / aosora_wiki'),
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
