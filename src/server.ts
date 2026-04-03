/**
 * MCPサーバー定義
 *
 * createServer で3つのツールを登録する:
 * 1. search_docs  - キーワード検索（summary返却）
 * 2. get_doc      - 全文取得（id → DocEntry）
 * 3. list_categories - カテゴリ一覧
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SearchEngine } from './search/engine.js';
import { registerGetDocTool } from './tools/get-doc.js';
import { registerListCategoriesTool } from './tools/list-categories.js';
import { registerSearchDocsTool } from './tools/search-docs.js';

const SERVER_INSTRUCTIONS = `\
このサーバーは伺か（Ukagaka）の技術ドキュメントを検索します。

3つのソースからドキュメントを提供します:
- UKADOC: SSP公式仕様書（さくらスクリプト、SHIORIイベント、設定ファイル仕様、プロトコル規格）
- YAYA Wiki: YAYA SHIORIの文法、組み込み関数、実践Tips
- 里々Wiki: 里々SHIORIの構文、変数、関数、独自イベント、Tips

推奨ワークフロー:
1. list_categories でカテゴリ一覧を確認
2. search_docs でキーワード検索（要約を返す）
3. 詳細が必要なエントリは get_doc(id) で全文を取得

注意事項:
- ビルド時点のドキュメントスナップショットを検索します
- さくらスクリプトのタグ検索: \\s0 のように入力（バックスラッシュはそのまま）`;

export function createMcpServer(engine: SearchEngine): McpServer {
  const server = new McpServer(
    { name: 'ukagaka-doc-mcp', version: '0.1.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerSearchDocsTool(server, engine);
  registerGetDocTool(server, engine);
  registerListCategoriesTool(server);

  return server;
}
