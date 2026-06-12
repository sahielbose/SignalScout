import type { RawItem, SourceName } from '@/lib/types';

/** Incremental state carried between runs for one (source, key) pair. */
export interface AdapterCursor {
  lastSeenAt?: string | null;
  lastExternalId?: string | null;
  state?: Record<string, unknown>;
}

export interface AdapterInput {
  /** What to fetch: a board token, CIK, "owner/repo", a URL, etc. */
  key: string;
  cursor?: AdapterCursor | null;
  limit?: number;
  signal?: AbortSignal;
}

export interface AdapterResult {
  items: RawItem[];
  /** New cursor to persist (omit to leave the cursor unchanged). */
  cursor?: AdapterCursor;
}

export interface Adapter {
  source: SourceName;
  /** Human label for logs / UI. */
  label: string;
  /** Default polling interval hint in seconds (worker may override). */
  intervalSec: number;
  fetch(input: AdapterInput): Promise<AdapterResult>;
}

/** Convenience: only keep items newer than the cursor's lastSeenAt. */
export function isNewer(publishedAt: string | undefined, cursor?: AdapterCursor | null): boolean {
  if (!cursor?.lastSeenAt) return true;
  if (!publishedAt) return true;
  return new Date(publishedAt).getTime() > new Date(cursor.lastSeenAt).getTime();
}
