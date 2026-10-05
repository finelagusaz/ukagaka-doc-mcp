import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexUpdater } from '../src/index-updater.js';
import { SearchEngine } from '../src/search/engine.js';
import type { DocEntry } from '../src/types.js';

function entry(id: string): DocEntry {
  return {
    id,
    title: id,
    source: 'ukadoc',
    category: 'sakurascript',
    content: 'sample',
    url: `https://example.com/${id}`,
  };
}

function indexJson(generatedAt: string, ids: string[]): string {
  return JSON.stringify({ version: 1, generatedAt, entries: ids.map(entry) });
}

function setup(initialGeneratedAt: string, fetchFn: typeof fetch, maxBytes?: number) {
  const engine = new SearchEngine();
  engine.load([entry('old')]);
  const updater = new IndexUpdater({
    engine,
    url: 'https://example.com/index.json',
    generatedAt: initialGeneratedAt,
    fetchFn,
    maxBytes,
  });
  return { engine, updater };
}

describe('IndexUpdater', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('リモートが新しければ再ロードする', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => new Response(
      indexJson(new Date().toISOString(), ['new1', 'new2']),
      { status: 200, headers: { etag: '"abc"' } },
    ));
    const { engine, updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch);

    expect(await updater.update()).toBe('updated');
    expect(engine.size).toBe(2);
    expect(engine.getById('new1')).toBeDefined();
    expect(engine.getById('old')).toBeUndefined();
  });

  it('リモートが古いか同じなら再ロードしない', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => new Response(
      indexJson('2026-01-01T00:00:00.000Z', ['new1']),
      { status: 200 },
    ));
    const { engine, updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch);

    expect(await updater.update()).toBe('not-newer');
    expect(engine.getById('old')).toBeDefined();
  });

  it('未来の generatedAt は拒否し、現在のインデックスと ETag を維持する', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(
      indexJson('9999-01-01T00:00:00.000Z', ['future']),
      { status: 200, headers: { etag: '"future"' } },
    ));
    const { engine, updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch);

    expect(await updater.update()).toBe('failed');
    expect(engine.getById('old')).toBeDefined();
    expect(updater.currentGeneratedAt).toBe('2026-01-01T00:00:00.000Z');

    await updater.update();
    expect(fetchFn.mock.calls[1][1]?.headers).not.toHaveProperty('If-None-Match');
  });

  it('時計のずれの範囲内なら、わずかに未来の generatedAt も受け入れる', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => new Response(
      indexJson(new Date(Date.now() + 60 * 60 * 1000).toISOString(), ['new1']),
      { status: 200 },
    ));
    const { updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch);

    expect(await updater.update()).toBe('updated');
  });

  it('現在のインデックスが未来日時なら、正常なリモートで差し替える', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => new Response(
      indexJson(new Date().toISOString(), ['new1']),
      { status: 200 },
    ));
    const { engine, updater } = setup('9999-01-01T00:00:00.000Z', fetchFn as typeof fetch);

    expect(await updater.update()).toBe('updated');
    expect(engine.getById('new1')).toBeDefined();
  });

  it('2回目以降は ETag で条件付き取得し、304 なら何もしない', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (headers['If-None-Match'] === '"abc"') {
        return new Response(null, { status: 304 });
      }
      return new Response(
        indexJson(new Date().toISOString(), ['new1']),
        { status: 200, headers: { etag: '"abc"' } },
      );
    });
    const { updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch);

    expect(await updater.update()).toBe('updated');
    expect(await updater.update()).toBe('not-modified');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('HTTP エラーや不正なインデックスでは現在のインデックスを維持する', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const responses = [
      new Response('oops', { status: 500 }),
      new Response('{not json', { status: 200 }),
      new Response(JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), entries: [] }), { status: 200 }),
    ];
    const fetchFn = vi.fn(async () => responses.shift()!);
    const { engine, updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch);

    expect(await updater.update()).toBe('failed');
    expect(await updater.update()).toBe('failed');
    expect(await updater.update()).toBe('failed');
    expect(engine.getById('old')).toBeDefined();
    expect(updater.currentGeneratedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('上限を超える応答は読み込みを打ち切り、現在のインデックスを維持する', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const body = indexJson(new Date().toISOString(), ['new1', 'new2']);
    const pulled: number[] = [];
    // Content-Length を付けないストリームで、上限を超えた時点で読むのをやめることを確かめる
    const fetchFn = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled.push(pulled.length);
        if (pulled.length > 100) controller.close();
        else controller.enqueue(new TextEncoder().encode(body));
      },
    }), { status: 200 }));
    const { engine, updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch, body.length * 2);

    expect(await updater.update()).toBe('failed');
    expect(engine.getById('old')).toBeDefined();
    expect(pulled.length).toBeLessThan(10);
  });

  it('Content-Length が上限を超えていれば本文を読まずに拒否する', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const body = indexJson(new Date().toISOString(), ['new1']);
    const fetchFn = vi.fn(async () => new Response(body, {
      status: 200,
      headers: { 'content-length': String(body.length) },
    }));
    const { engine, updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch, body.length - 1);

    expect(await updater.update()).toBe('failed');
    expect(engine.getById('old')).toBeDefined();
  });

  it('上限以内なら BOM 付きでも読み込める', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const body = '\uFEFF' + indexJson(new Date().toISOString(), ['new1']);
    const fetchFn = vi.fn(async () => new Response(body, { status: 200 }));
    const { engine, updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch, body.length * 2);

    expect(await updater.update()).toBe('updated');
    expect(engine.getById('new1')).toBeDefined();
  });

  it('ネットワークエラーでも throw しない', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const { updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch);

    expect(await updater.update()).toBe('failed');
  });
});
