import type { MonitoredSource } from '@/lib/pipeline/ingest';
import type { IcpDefinition } from '@/lib/types';

/** A starter ICP used by the seed script + one-click onboarding. */
export const SAMPLE_ICP: { name: string; definition: IcpDefinition } = {
  name: 'Fintech & developer-tools companies - funding, GTM expansion, launches',
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

/** Workflow presets the user can start from on the ICP page (one click to create). */
export const PRESET_ICPS: { name: string; description: string; definition: IcpDefinition }[] = [
  {
    name: 'Incorporation prospecting',
    description: 'Catch founders the moment a new company forms, then track early banking, payroll, and ML-infra intent.',
    definition: {
      industries: ['ai', 'fintech', 'developer tools', 'saas', 'infrastructure'],
      titles: ['founder', 'co-founder', 'ceo', 'cto'],
      companySize: '1-50',
      keywords: ['incorporated', 'stealth', 'new company', 'banking', 'payroll', 'gpu', 'compute', 'ml infra', 'seed'],
      geos: ['United States', 'Remote'],
      signalTypes: ['incorporation', 'funding', 'hiring', 'product_launch'],
      notify: { email: true, slack: false },
      notifyThreshold: 0.6,
    },
  },
  {
    name: 'Enterprise account monitoring',
    description: 'Track whole target accounts and watch buying signals emerge across their departments.',
    definition: {
      industries: ['enterprise', 'fintech', 'saas', 'infrastructure', 'developer tools'],
      titles: ['vp', 'head of', 'director', 'staff', 'principal', 'platform', 'revenue operations'],
      companySize: '1000+',
      keywords: ['platform', 'migration', 'procurement', 'vendor', 'rollout', 'department', 'evaluating', 'rfp'],
      geos: ['United States'],
      signalTypes: ['buying_intent', 'expansion', 'hiring', 'partnership', 'product_launch'],
      notify: { email: true, slack: true },
      notifyThreshold: 0.7,
    },
  },
  {
    name: 'Conference prep',
    description: 'Monitor event and meetup attendees, and prioritize the ones already showing interest in what you sell.',
    definition: {
      industries: ['developer tools', 'ai', 'saas', 'fintech'],
      titles: ['founder', 'engineer', 'product', 'developer experience', 'gtm', 'growth'],
      companySize: '11-500',
      keywords: ['meetup', 'conference', 'summit', 'rsvp', 'speaker', 'attendee', 'devconf'],
      geos: ['United States', 'Remote'],
      signalTypes: ['event', 'thought_leadership', 'product_launch', 'github_release'],
      notify: { email: true, slack: false },
      notifyThreshold: 0.55,
    },
  },
];

/** A fast subset for onboarding (populate a feed in a few seconds). */
export const QUICK_TARGETS: MonitoredSource[] = [
  { source: 'greenhouse', key: 'stripe' },
  { source: 'lever', key: 'spotify' },
  { source: 'ashby', key: 'ramp' },
  { source: 'github', key: 'vercel/next.js' },
];

/**
 * Curated, real, populated public sources used by the seed + the default worker
 * schedule. All free / no-auth (GitHub uses an optional free token). Each target
 * is fetched in isolation (runSource try/catch), so an ATS board that has moved
 * providers simply logs and is skipped; it never breaks the rest of the run.
 *
 * Every entry below is one company (or public feed) we watch. Add a company by
 * adding its public board token, repo, or SEC CIK here.
 */
export const DEFAULT_TARGETS: MonitoredSource[] = [
  // ── hiring / expansion: public Greenhouse boards (boards.greenhouse.io/<token>)
  { source: 'greenhouse', key: 'stripe' },
  { source: 'greenhouse', key: 'gitlab' },
  { source: 'greenhouse', key: 'airbnb' },
  { source: 'greenhouse', key: 'robinhood' },
  { source: 'greenhouse', key: 'coinbase' },
  { source: 'greenhouse', key: 'databricks' },
  { source: 'greenhouse', key: 'dropbox' },
  { source: 'greenhouse', key: 'lyft' },
  { source: 'greenhouse', key: 'asana' },
  { source: 'greenhouse', key: 'reddit' },
  { source: 'greenhouse', key: 'instacart' },
  { source: 'greenhouse', key: 'doordash' },
  { source: 'greenhouse', key: 'affirm' },
  { source: 'greenhouse', key: 'gusto' },
  { source: 'greenhouse', key: 'benchling' },
  { source: 'greenhouse', key: 'cloudflare' },
  { source: 'greenhouse', key: 'datadog' },
  { source: 'greenhouse', key: 'samsara' },
  { source: 'greenhouse', key: 'sofi' },
  { source: 'greenhouse', key: 'discord' },

  // ── hiring / expansion: public Lever boards (jobs.lever.co/<token>)
  { source: 'lever', key: 'spotify' },
  { source: 'lever', key: 'palantir' },
  { source: 'lever', key: 'netflix' },
  { source: 'lever', key: 'nubank' },
  { source: 'lever', key: 'plaid' },

  // ── hiring / expansion: public Ashby boards (jobs.ashbyhq.com/<token>)
  { source: 'ashby', key: 'ramp' },
  { source: 'ashby', key: 'notion' },
  { source: 'ashby', key: 'linear' },
  { source: 'ashby', key: 'vanta' },
  { source: 'ashby', key: 'mercury' },
  { source: 'ashby', key: 'hex' },
  { source: 'ashby', key: 'runway' },
  { source: 'ashby', key: 'deel' },
  { source: 'ashby', key: 'baseten' },
  { source: 'ashby', key: 'clay' },

  // ── product / technical: GitHub releases (org/repo). Kept moderate so the
  //    unauthenticated rate limit (60 req/hr) is never a problem on a seed run.
  { source: 'github', key: 'vercel/next.js' },
  { source: 'github', key: 'stripe/stripe-node' },
  { source: 'github', key: 'openai/openai-python' },
  { source: 'github', key: 'facebook/react' },
  { source: 'github', key: 'supabase/supabase' },
  { source: 'github', key: 'prisma/prisma' },
  { source: 'github', key: 'langchain-ai/langchain' },
  { source: 'github', key: 'anthropics/anthropic-sdk-python' },
  { source: 'github', key: 'tailwindlabs/tailwindcss' },
  { source: 'github', key: 'denoland/deno' },
  { source: 'github', key: 'oven-sh/bun' },
  { source: 'github', key: 'drizzle-team/drizzle-orm' },

  // ── funding / filings: SEC EDGAR (form-d = new raises; CIKs = per-company)
  { source: 'sec', key: 'form-d' },
  { source: 'sec', key: '320193' }, // Apple
  { source: 'sec', key: '789019' }, // Microsoft
  { source: 'sec', key: '1045810' }, // Nvidia
  { source: 'sec', key: '1318605' }, // Tesla
  { source: 'sec', key: '1679788' }, // Coinbase
  { source: 'sec', key: '1559720' }, // Airbnb

  // ── content / events
  { source: 'web', key: 'https://stripe.com/blog' },

  // ── launches (free, no-auth public feeds)
  { source: 'hackernews', key: 'show_hn' },
  { source: 'producthunt', key: 'feed' },
];
