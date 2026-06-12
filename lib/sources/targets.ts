import type { MonitoredSource } from '@/lib/pipeline/ingest';

/**
 * Curated, real, populated public sources used by the seed + the default worker
 * schedule. All free / no-auth (GitHub uses an optional free token).
 */
export const DEFAULT_TARGETS: MonitoredSource[] = [
  // hiring / expansion (public ATS)
  { source: 'greenhouse', key: 'stripe' },
  { source: 'greenhouse', key: 'gitlab' },
  { source: 'greenhouse', key: 'airbnb' },
  { source: 'lever', key: 'spotify' },
  { source: 'lever', key: 'palantir' },
  { source: 'ashby', key: 'ramp' },
  { source: 'ashby', key: 'notion' },
  // product / technical (GitHub releases)
  { source: 'github', key: 'vercel/next.js' },
  { source: 'github', key: 'stripe/stripe-node' },
  { source: 'github', key: 'openai/openai-python' },
  // funding (SEC)
  { source: 'sec', key: 'form-d' },
  { source: 'sec', key: '320193' }, // Apple (demo of per-company submissions)
  // content / events
  { source: 'web', key: 'https://stripe.com/blog' },
];
