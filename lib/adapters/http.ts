import { env } from '@/lib/env';

/**
 * Polite HTTP client for source adapters:
 *  - per-host minimum interval (SEC requires <=10 req/s; we cap conservatively)
 *  - sends a real User-Agent (SEC rejects requests without one)
 *  - retries 429/5xx with exponential backoff
 *  - hard timeout via AbortController
 */

const SEC_HOSTS = new Set(['efts.sec.gov', 'data.sec.gov', 'www.sec.gov']);

function minIntervalForHost(host: string): number {
  if (SEC_HOSTS.has(host)) return 110; // ~9 req/s, under SEC's 10 req/s cap
  return 200; // 5 req/s default politeness
}

const lastRequestAt = new Map<string, number>();
const hostChain = new Map<string, Promise<void>>();

function nowMs(): number {
  // Date.now is available in Node runtime (adapters never run in workflow scripts).
  return Date.now();
}

/** Serialize + space out requests per host. */
async function throttle(host: string): Promise<void> {
  const prev = hostChain.get(host) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  hostChain.set(
    host,
    prev.then(() => next),
  );
  await prev;
  const min = minIntervalForHost(host);
  const since = nowMs() - (lastRequestAt.get(host) ?? 0);
  if (since < min) {
    await new Promise((r) => setTimeout(r, min - since));
  }
  lastRequestAt.set(host, nowMs());
  // release the chain slot on the next tick so the following caller proceeds
  setTimeout(release, 0);
}

export function userAgentFor(host: string): string {
  if (SEC_HOSTS.has(host)) return env().SEC_USER_AGENT;
  return 'SignalScout/0.1 (+https://github.com/sahielbose/Signal-Scout)';
}

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  accept?: string;
}

async function rawFetch(url: string, opts: HttpOptions): Promise<Response> {
  const host = new URL(url).host;
  await throttle(host);
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), opts.timeoutMs ?? 15_000);
  if (opts.signal) opts.signal.addEventListener('abort', () => ac.abort(), { once: true });
  try {
    return await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'User-Agent': userAgentFor(host),
        Accept: opts.accept ?? 'application/json,text/html;q=0.9,*/*;q=0.8',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body,
      signal: ac.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetry(url: string, opts: HttpOptions): Promise<Response> {
  const retries = opts.retries ?? 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await rawFetch(url, opts);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const backoff = Math.min(8000, 400 * 2 ** attempt);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.min(8000, 400 * 2 ** attempt)));
        continue;
      }
    }
  }
  throw lastErr ?? new Error(`request failed: ${url}`);
}

export async function httpJson<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const res = await withRetry(url, { ...opts, accept: 'application/json' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new HttpError(res.status, url, body.slice(0, 300));
  }
  return (await res.json()) as T;
}

export async function httpText(url: string, opts: HttpOptions = {}): Promise<string> {
  const res = await withRetry(url, opts);
  if (!res.ok) {
    throw new HttpError(res.status, url, '');
  }
  return res.text();
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    public detail: string,
  ) {
    super(`HTTP ${status} for ${url}${detail ? ` - ${detail}` : ''}`);
    this.name = 'HttpError';
  }
}
