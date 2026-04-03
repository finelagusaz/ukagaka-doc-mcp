#!/usr/bin/env node
/**
 * エントリポイント
 *
 * 起動シーケンス:
 * 1. data/index.json をロード + freshness 判定
 * 2. MCPサーバー作成
 * 3. stdio トランスポートで接続
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initializeSearchEngine } from './bootstrap.js';
import { createMcpServer } from './server.js';

async function main(): Promise<void> {
  // 1. index ロード（失敗時は Error をthrowしてプロセス終了）
  const engine = initializeSearchEngine();

  // 2. MCPサーバー作成
  const server = createMcpServer(engine);

  // 3. stdio 接続
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[ukagaka-doc-mcp] Server ready');
}

main().catch(err => {
  console.error('[ukagaka-doc-mcp] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
