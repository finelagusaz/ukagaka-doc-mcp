import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHttpServer, type RunningHttpServer } from '../src/http-server.js';
import { SearchEngine } from '../src/search/engine.js';

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

describe('http-server', () => {
  it('initialize と tools/call にステートレスで応答する', async () => {
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
    const init = await initRes.json() as { result: { serverInfo: { name: string } } };
    expect(init.result.serverInfo.name).toBe('ukagaka-doc-mcp');

    const callRes = await rpc(url, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'get_doc', arguments: { id: 'ukadoc:list_sakura_script:tag_s0' } },
    }, { 'mcp-protocol-version': '2025-06-18' });
    expect(callRes.status).toBe(200);
    const call = await callRes.json() as { result: { content: { text: string }[] } };
    expect(call.result.content[0].text).toContain('sample');
  });

  it('POST 以外は 405、/mcp 以外は 404', async () => {
    const url = await start();
    expect((await fetch(url)).status).toBe(405);
    expect((await fetch(url.replace('/mcp', '/other'), { method: 'POST' })).status).toBe(404);
  });
});
