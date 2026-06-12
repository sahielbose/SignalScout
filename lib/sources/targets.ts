import type { MonitoredSource } from '@/lib/pipeline/ingest';
import type { IcpDefinition } from '@/lib/types';

/** A starter ICP used by the seed script + one-click onboarding. */
export const SAMPLE_ICP: { name: string; definition: IcpDefinition } = {
  name: 'Fintech & developer-tools companies — funding, GTM expansion, launches',
  definition: {
    industries: ['fintech', 'developer tools', 'payments', 'saas', 'infrastructure', 'ai'],
    titles: ['account executive', 'head of sales', 'gtm', 'revenue', 'sales lead', 'growth'],
    companySize: '11-500',
    keywords: ['payments', 'api', 'developer', 'platform', 'infrastructure', 'fintech', 'data', 'sales', 'revenue', 'sdk'],
    geos: ['United States', 'Remote'],
    signalTypes: ['funding', 'expansion', 'product_launch', 'github_release', 'partnership', 'buying_intent'],
    notify: { email: true, slack: false },
    notifyThreshold: 0.6,
  },
};

/** A fast subset for onboarding (populate a feed in a few seconds). */
export const QUICK_TARGETS: MonitoredSource[] = [
  { source: 'greenhouse', key: 'stripe' },
  { source: 'lever', key: 'spotify' },
  { source: 'ashby', key: 'ramp' },
  { source: 'github', key: 'vercel/next.js' },
];

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
