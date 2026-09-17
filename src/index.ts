#!/usr/bin/env node
/**
 * エントリポイント
 *
 * stdio モード（デフォルト）:
 * 1. data/index.json をロード + freshness 判定
 * 2. MCPサーバー作成
 * 3. stdio トランスポートで接続
 *
 * HTTP モード（--http）:
 * 1. data/index.json をロード + freshness 判定
 * 2. Streamable HTTP サーバーを listen（デフォルト 127.0.0.1:8951）
 * 3. 起動直後と24時間ごとにリモートの index.json を確認し、新しければ再ロード
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadSearchEngine } from './bootstrap.js';
import { parseCliArgs, USAGE } from './cli.js';
import { INDEX_UPDATE_INTERVAL_MS, REMOTE_INDEX_URL } from './constants.js';
import { MCP_ENDPOINT_PATH, startHttpServer } from './http-server.js';
import { IndexUpdater } from './index-updater.js';
import { createMcpServer } from './server.js';

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  if (options.mode === 'help') {
    console.log(USAGE);
    return;
  }

  // index ロード（失敗時は Error をthrowしてプロセス終了）
  const { engine, generatedAt } = loadSearchEngine();

  if (options.mode === 'stdio') {
    const server = createMcpServer(engine);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[ukagaka-doc-mcp] Server ready');
    return;
  }

  const running = await startHttpServer(engine, { host: options.host, port: options.port });
  const { address, port } = running.address;
  const displayHost = address.includes(':') ? `[${address}]` : address;
  console.error(`[ukagaka-doc-mcp] HTTP server ready: http://${displayHost}:${port}${MCP_ENDPOINT_PATH}`);

  const updater = new IndexUpdater({ engine, url: REMOTE_INDEX_URL, generatedAt });
  updater.start(INDEX_UPDATE_INTERVAL_MS);

  const shutdown = () => {
    updater.stop();
    running.close().finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('[ukagaka-doc-mcp] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
