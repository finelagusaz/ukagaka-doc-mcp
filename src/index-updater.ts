/**
 * index-updater.ts
 *
 * HTTP モード用のインデックス自動更新:
 * 1. リモートの index.json を取得（ETag による条件付き GET）
 * 2. スキーマ検証
 * 3. generatedAt が現在より新しければ SearchEngine に再ロード
 *
 * 取得したインデックスはメモリ上でのみ差し替え、ファイルには書き込まない
 * （npm グローバルインストール等で書き込み権限がない環境でも動作させるため）。
 */

import { getFreshnessWarning } from './bootstrap.js';
import { INDEX_FETCH_TIMEOUT_MS } from './constants.js';
import { parseAndValidateIndexFile } from './index-validation.js';
import type { SearchEngine } from './search/engine.js';

export type UpdateResult = 'updated' | 'not-modified' | 'not-newer' | 'failed' | 'skipped';

export interface IndexUpdaterOptions {
  engine: SearchEngine;
  url: string;
  /** 現在ロード済みのインデックスの generatedAt */
  generatedAt: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class IndexUpdater {
  private readonly engine: SearchEngine;
  private readonly url: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private generatedAt: string;
  private etag: string | undefined;
  private running = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(options: IndexUpdaterOptions) {
    this.engine = options.engine;
    this.url = options.url;
    this.generatedAt = options.generatedAt;
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? INDEX_FETCH_TIMEOUT_MS;
  }

  get currentGeneratedAt(): string {
    return this.generatedAt;
  }

  /**
   * リモートを確認し、新しいインデックスがあれば再ロードする。
   * 失敗しても throw せず、現在のインデックスで動作を継続する。
   */
  async update(): Promise<UpdateResult> {
    if (this.running) {
      return 'skipped';
    }
    this.running = true;
    try {
      return await this.doUpdate();
    } catch (error) {
      console.error(
        `[index-updater] Update failed, keeping current index: ${error instanceof Error ? error.message : error}`,
      );
      return 'failed';
    } finally {
      this.running = false;
    }
  }

  /**
   * 即時に1回更新し、以後 intervalMs ごとに更新する。
   */
  start(intervalMs: number): void {
    this.stop();
    void this.update();
    this.timer = setInterval(() => void this.update(), intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async doUpdate(): Promise<UpdateResult> {
    const headers: Record<string, string> = {};
    if (this.etag) {
      headers['If-None-Match'] = this.etag;
    }

    const response = await this.fetchFn(this.url, {
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 304) {
      console.error('[index-updater] Index not modified');
      return 'not-modified';
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const raw = await response.text();
    const { indexFile, warnings } = parseAndValidateIndexFile(raw);
    for (const warning of warnings) {
      console.error(warning);
    }

    // 検証まで通ったレスポンスの ETag だけ記憶する
    this.etag = response.headers.get('etag') ?? undefined;

    if (!isNewer(indexFile.generatedAt, this.generatedAt)) {
      console.error(
        `[index-updater] Remote index is not newer (remote: ${indexFile.generatedAt}, current: ${this.generatedAt})`,
      );
      return 'not-newer';
    }

    this.engine.load(indexFile.entries);
    this.generatedAt = indexFile.generatedAt;
    console.error(
      `[index-updater] Reloaded ${this.engine.size} entries from ${this.url} (built: ${indexFile.generatedAt})`,
    );

    const freshnessWarning = getFreshnessWarning(indexFile.generatedAt);
    if (freshnessWarning) {
      console.error(freshnessWarning);
    }

    return 'updated';
  }
}

function isNewer(candidate: string, current: string): boolean {
  const candidateTime = new Date(candidate).getTime();
  if (isNaN(candidateTime)) {
    return false;
  }
  const currentTime = new Date(current).getTime();
  if (isNaN(currentTime)) {
    return true;
  }
  return candidateTime > currentTime;
}
