import { getAdapter } from '@/lib/adapters';
import { readCursor, writeCursor } from '@/lib/adapters/cursor';
import { ingestMany } from '@/lib/entity/resolution';
import type { SourceName } from '@/lib/types';

export interface RunSourceResult {
  source: string;
  key: string;
  fetched: number;
  inserted: number;
  skipped: number;
  error?: string;
}

/** Fetch one (source, key), resolve+dedupe into signals, advance the cursor. */
export async function runSource(
  source: SourceName,
  key: string,
  opts: { limit?: number } = {},
): Promise<RunSourceResult> {
  const adapter = getAdapter(source);
  try {
    const cursor = await readCursor(source, key);
    const { items, cursor: newCursor } = await adapter.fetch({ key, cursor, limit: opts.limit });
    const res = await ingestMany(items);
    if (newCursor) await writeCursor(source, key, newCursor);
    return { source, key, fetched: items.length, inserted: res.inserted, skipped: res.skipped };
  } catch (err) {
    return { source, key, fetched: 0, inserted: 0, skipped: 0, error: (err as Error).message };
  }
}

export interface MonitoredSource {
  source: SourceName;
  key: string;
}

/** Run a batch of monitored (source,key) pairs sequentially (polite). */
export async function runSources(
  targets: MonitoredSource[],
  opts: { limit?: number } = {},
): Promise<RunSourceResult[]> {
  const out: RunSourceResult[] = [];
  for (const t of targets) {
    out.push(await runSource(t.source, t.key, opts));
  }
  return out;
}
