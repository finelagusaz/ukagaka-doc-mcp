import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHttpServer, type RunningHttpServer } from '../src/http-server.js';
import { SearchEngine } from '../src/search/engine.js';
import packageJson from '../package.json' with { type: 'json' };

let running: RunningHttpServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
  vi.restoreAllMocks();
});

async function start(): Promise<string> {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const engine = new SearchEngine();
  engine.load([{
    id: 'ukadoc:list_sakura_script:tag_s0',
    title: '\\s0',
    source: 'ukadoc',
    category: 'sakurascript',
    content: 'sample',
    url: 'https://example.com',
  }]);
  running = await startHttpServer(engine, { host: '127.0.0.1', port: 0 });
  return `http://127.0.0.1:${running.address.port}/mcp`;
}

function rpc(url: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** JSON 応答と SSE 応答（`data:` 行）のどちらからも JSON-RPC メッセージを取り出す */
async function readRpc<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.headers.get('content-type')?.includes('text/event-stream')) {
    return JSON.parse(text) as T;
  }
  const data = text.split('\n').find(line => line.startsWith('data:'));
  if (!data) throw new Error(`SSE にデータ行がありません: ${text}`);
  return JSON.parse(data.slice('data:'.length)) as T;
}

async function connectClient(url: string, versionNegotiation?: ConstructorParameters<typeof Client>[1]) {
  const client = new Client({ name: 'test', version: '0.0.0' }, versionNegotiation);
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

describe('http-server', () => {
  it('2025 系の initialize と tools/call にステートレスかつ JSON で応答する', async () => {
    const url = await start();

    const initRes = await rpc(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '0.0.0' },
      },
    });
    expect(initRes.status).toBe(200);
    expect(initRes.headers.get('mcp-session-id')).toBeNull();
    expect(initRes.headers.get('content-type')).toContain('application/json');
    const init = await initRes.json() as { result: { serverInfo: { name: string; version: string } } };
    expect(init.result.serverInfo.name).toBe('ukagaka-doc-mcp');
    expect(init.result.serverInfo.version).toBe(packageJson.version);

    const callRes = await rpc(url, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'get_doc', arguments: { id: 'ukadoc:list_sakura_script:tag_s0' } },
    }, { 'mcp-protocol-version': '2025-06-18' });
    expect(callRes.status).toBe(200);
    expect(callRes.headers.get('content-type')).toContain('application/json');
    const call = await callRes.json() as { result: { content: { text: string }[] } };
    expect(call.result.content[0].text).toContain('sample');
  });

  it.each([
    ['2025 系（initialize ハンドシェイク）', undefined, 'legacy'],
    ['2026-07-28（server/discover）', { versionNegotiation: { mode: { pin: '2026-07-28' } } }, 'modern'],
  ] as const)('%s のクライアントからツールを呼べる', async (_label, options, era) => {
    const url = await start();
    const client = await connectClient(url, options);
    try {
      expect(client.getProtocolEra()).toBe(era);

      const { tools } = await client.listTools();
      expect(tools.map(tool => tool.name).sort()).toEqual(['get_doc', 'list_categories', 'search_docs']);

      const result = await client.callTool({ name: 'search_docs', arguments: { query: '\\s0' } });
      const content = result.content as { type: string; text: string }[];
      expect(JSON.parse(content[0].text)).toMatchObject({ status: 'ok', total: 1 });
    } finally {
      await client.close();
    }
  });

  it('2025 系の通知には 202、バッチには JSON 配列で応答する', async () => {
    const url = await start();

    const notifyRes = await rpc(url, { jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(notifyRes.status).toBe(202);

    const batchRes = await rpc(url, [
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { jsonrpc: '2.0', id: 2, method: 'ping' },
    ], { 'mcp-protocol-version': '2025-06-18' });
    expect(batchRes.status).toBe(200);
    expect(batchRes.headers.get('content-type')).toContain('application/json');
    const batch = await batchRes.json() as { id: number }[];
    expect(batch.map(message => message.id).sort()).toEqual([1, 2]);
  });

  it('POST 以外は 405、/mcp 以外は 404', async () => {
    const url = await start();
    expect((await fetch(url)).status).toBe(405);
    expect((await fetch(url.replace('/mcp', '/other'), { method: 'POST' })).status).toBe(404);
  });
});
