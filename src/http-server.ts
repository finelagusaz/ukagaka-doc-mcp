/**
 * http-server.ts
 *
 * Streamable HTTP トランスポートで MCP サーバーを公開する（ステートレス・認証なし）。
 * createMcpHandler により 2026-07-28 リビジョン（リクエスト単位の _meta エンベロープ）と
 * 2025 系以前（initialize ハンドシェイク）の両方を同一エンドポイントで受け付ける。
 * リクエストごとに McpServer を生成し、SearchEngine は共有する。
 * Host / Origin 検証は行わない（リバースプロキシの背後で使う前提）。
 *
 * エンドポイント: POST /mcp
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { toNodeHandler, type NodeMcpRequestHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { SearchEngine } from './search/engine.js';
import { createMcpServer } from './server.js';

export const MCP_ENDPOINT_PATH = '/mcp';

export interface HttpServerOptions {
  host: string;
  port: number;
}

export interface RunningHttpServer {
  server: Server;
  address: AddressInfo;
  close(): Promise<void>;
}

export function startHttpServer(
  engine: SearchEngine,
  options: HttpServerOptions,
): Promise<RunningHttpServer> {
  const mcpHandler = createMcpHandler(() => createMcpServer(engine), {
    onerror: error => console.error('[http] MCP handler error:', error),
  });
  const nodeHandler = toNodeHandler(mcpHandler);

  const httpServer = createServer((req, res) => {
    handleRequest(nodeHandler, req, res).catch(error => {
      console.error('[http] Error handling request:', error);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, 'Internal server error');
      } else {
        res.end();
      }
    });
  });

  return new Promise((resolvePromise, rejectPromise) => {
    httpServer.once('error', rejectPromise);
    httpServer.listen(options.port, options.host, () => {
      httpServer.off('error', rejectPromise);
      const address = httpServer.address() as AddressInfo;
      resolvePromise({
        server: httpServer,
        address,
        close: async () => {
          await mcpHandler.close();
          await new Promise<void>((resolveClose, rejectClose) => {
            httpServer.close(err => (err ? rejectClose(err) : resolveClose()));
            httpServer.closeAllConnections();
          });
        },
      });
    });
  });
}

async function handleRequest(
  nodeHandler: NodeMcpRequestHandler,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (pathname !== MCP_ENDPOINT_PATH) {
    sendJsonRpcError(res, 404, -32000, 'Not found');
    return;
  }

  // ステートレスのためセッション用の GET (SSE) / DELETE は提供しない
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJsonRpcError(res, 405, -32000, 'Method not allowed');
    return;
  }

  await nodeHandler(req, res);
}

function sendJsonRpcError(res: ServerResponse, status: number, code: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}
