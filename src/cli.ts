/**
 * コマンドライン引数の解釈
 *
 * - 引数なし: stdio モード（従来どおり）
 * - --http: Streamable HTTP モード（--host / --port で listen 先を変更可）
 */

import { parseArgs } from 'node:util';
import { DEFAULT_HTTP_HOST, DEFAULT_HTTP_PORT } from './constants.js';

export type CliOptions =
  | { mode: 'stdio' }
  | { mode: 'http'; host: string; port: number }
  | { mode: 'help' };

export const USAGE = `\
Usage: ukagaka-doc-mcp [options]

Options:
  --http          Start as a Streamable HTTP MCP server (stateless, no auth)
  --host <host>   Host to listen on in HTTP mode (default: ${DEFAULT_HTTP_HOST})
  --port <port>   Port to listen on in HTTP mode (default: ${DEFAULT_HTTP_PORT})
  -h, --help      Show this help

Without --http, the server communicates over stdio.`;

export function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      http: { type: 'boolean', default: false },
      host: { type: 'string' },
      port: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    return { mode: 'help' };
  }

  if (!values.http) {
    if (values.host !== undefined || values.port !== undefined) {
      throw new Error('--host / --port require --http');
    }
    return { mode: 'stdio' };
  }

  const host = values.host ?? DEFAULT_HTTP_HOST;
  if (host.length === 0) {
    throw new Error('--host must not be empty');
  }

  let port = DEFAULT_HTTP_PORT;
  if (values.port !== undefined) {
    if (!/^\d+$/.test(values.port)) {
      throw new Error(`Invalid --port: ${values.port}`);
    }
    port = Number(values.port);
    if (port < 0 || port > 65535) {
      throw new Error(`Invalid --port: ${values.port}`);
    }
  }

  return { mode: 'http', host, port };
}
