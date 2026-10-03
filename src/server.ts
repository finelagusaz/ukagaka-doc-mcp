/**
 * MCPサーバー定義
 *
 * createServer で3つのツールを登録する:
 * 1. search_docs  - キーワード検索（summary返却）
 * 2. get_doc      - 全文取得（id → DocEntry）
 * 3. list_categories - カテゴリ一覧
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { SOURCES, SOURCE_VALUES } from './constants.js';
import type { SearchEngine } from './search/engine.js';
import { registerGetDocTool } from './tools/get-doc.js';
import { registerListCategoriesTool } from './tools/list-categories.js';
import { registerSearchDocsTool } from './tools/search-docs.js';

const SOURCE_LIST = Object.values(SOURCES).map(s => `- ${s.name}: ${s.description}`).join('\n');

export const SERVER_INSTRUCTIONS = `\
このサーバーは伺か（Ukagaka）の技術ドキュメントを検索します。

${SOURCE_VALUES.length}つのソースからドキュメントを提供します:
${SOURCE_LIST}

search_docs の summary は本文の冒頭部分だけなので、続きや詳細は get_doc(id) で全文を取得してください。
category の値は search_docs のスキーマに列挙されています。list_categories は各カテゴリのラベルを確認するためのものです。

注意事項:
- 定期的に取得したドキュメントのスナップショットを検索します。各ソースの最新の更新は反映されていないことがあります
- インデックスはページ/セクション単位。タイトルは "OnBoot" "\\q[タイトル,ID]" "charset,文字コード" のような原文の見出しがそのまま入っています
- search_docs の query は単語1つだけ（空白区切りの複数語・自然文は0件になる）。絞り込みは category / source で行ってください
- さくらスクリプトのタグ検索: \\s0 のように入力（バックスラッシュはそのまま）`;

// src/ と dist/ のどちらから実行しても、親ディレクトリがパッケージルート
const PACKAGE_JSON_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const { version: PACKAGE_VERSION } = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as { version: string };

export function createMcpServer(engine: SearchEngine): McpServer {
  const server = new McpServer(
    { name: 'ukagaka-doc-mcp', version: PACKAGE_VERSION },
    {
      instructions: SERVER_INSTRUCTIONS,
      // ツール一覧は起動後に変わらない（index 差し替えでもスキーマは不変）。
      // SDK は registerTool 時に未指定なら listChanged: true を宣言するので明示的に false にする
      capabilities: { tools: { listChanged: false } },
    },
  );

  registerSearchDocsTool(server, engine);
  registerGetDocTool(server, engine);
  registerListCategoriesTool(server);

  return server;
}
