import { env } from '@/lib/env';
import { log } from '@/lib/logger';

/**
 * Optional error tracking. Dependency-free by default - when SENTRY_DSN is set,
 * errors POST to Sentry's store endpoint. For richer tracing, install
 * @sentry/nextjs and forward here (documented opt-in; off by default).
 */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  const e = err instanceof Error ? err : new Error(String(err));
  log.error(e.message, { stack: e.stack, ...context });

  const dsn = env().SENTRY_DSN;
  if (!dsn) return;
  try {
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) return;
    const [, key, host, projectId] = m;
    const url = `https://${host}/api/${projectId}/store/?sentry_key=${key}&sentry_version=7`;
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        platform: 'node',
        exception: { values: [{ type: e.name, value: e.message }] },
        extra: context,
      }),
    }).catch(() => {});
  } catch {
    /* never throw from the error reporter */
  }
}
