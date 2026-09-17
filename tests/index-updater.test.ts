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

function setup(initialGeneratedAt: string, fetchFn: typeof fetch) {
  const engine = new SearchEngine();
  engine.load([entry('old')]);
  const updater = new IndexUpdater({
    engine,
    url: 'https://example.com/index.json',
    generatedAt: initialGeneratedAt,
    fetchFn,
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

  it('ネットワークエラーでも throw しない', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const { updater } = setup('2026-01-01T00:00:00.000Z', fetchFn as typeof fetch);

    expect(await updater.update()).toBe('failed');
  });
});
