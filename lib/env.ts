import { z } from 'zod';

/**
 * Central, zod-validated environment access.
 *
 * Design goal: the app + build must run with ZERO keys (mocks/fallbacks kick in).
 * So almost everything is optional with a sane default; only truly-required-at-runtime
 * values (DATABASE_URL) are asserted where they're used, not at import time.
 */
const bool = (def = false) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const num = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null || v === '' ? def : Number(v)))
    .pipe(z.number());

const EnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .default('postgres://signalscout:signalscout@localhost:5434/signalscout'),

  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),

  SEC_USER_AGENT: z.string().default('Signal Scout dev@example.com'),
  GITHUB_TOKEN: z.string().optional(),

  LLM_PROVIDER: z.enum(['anthropic', 'ollama', 'mock']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_CLASSIFY_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  LLM_RESEARCH_MODEL: z.string().default('claude-sonnet-4-6'),
  LLM_EMBED_MODEL: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_CLASSIFY_MODEL: z.string().default('llama3.1'),
  OLLAMA_RESEARCH_MODEL: z.string().default('llama3.1'),

  SEARCH_PROVIDER: z.enum(['tavily', 'exa', 'searxng', 'mock']).default('tavily'),
  TAVILY_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  SEARXNG_URL: z.string().default('http://localhost:8888'),

  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('Signal Scout <noreply@example.com>'),
  SLACK_WEBHOOK_URL: z.string().optional(),

  DAILY_CLASSIFY_QUOTA: num(500),
  DAILY_RESEARCH_QUOTA: num(25),
  GLOBAL_BUDGET_USD: num(10),
  GLOBAL_KILL_SWITCH: bool(false),

  ENABLE_PAID_ENRICHMENT: bool(false),
  APOLLO_API_KEY: z.string().optional(),
  PDL_API_KEY: z.string().optional(),

  // CRM push (Stage-2, gated, off by default). No keys -> a safe no-op provider.
  ENABLE_CRM: bool(false),
  CRM_PROVIDER: z.enum(['none', 'hubspot', 'salesforce']).default('none'),
  HUBSPOT_API_KEY: z.string().optional(),
  SALESFORCE_INSTANCE_URL: z.string().optional(),
  SALESFORCE_ACCESS_TOKEN: z.string().optional(),

  // Incorporation feed (off by default; needs a paid registry like OpenCorporates).
  ENABLE_INCORPORATION: bool(false),
  OPENCORPORATES_API_KEY: z.string().optional(),

  // Scheduled flat-file delivery (email always works via log-fallback; S3 needs keys).
  SCHEDULED_CSV_DELIVERY: bool(false),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Never hard-crash the whole app on env; log and fall back to defaults.
    console.warn('[env] validation warnings:', parsed.error.flatten().fieldErrors);
    cached = EnvSchema.parse({}); // all defaults
    return cached;
  }
  cached = parsed.data;
  return cached;
}

/** True when we have a real LLM key wired; otherwise the pipeline uses deterministic mocks. */
export function hasLLM(): boolean {
  const e = env();
  if (e.GLOBAL_KILL_SWITCH) return false;
  if (e.LLM_PROVIDER === 'anthropic') return !!e.ANTHROPIC_API_KEY;
  if (e.LLM_PROVIDER === 'ollama') return true; // assume local server present
  return false;
}

export function hasSearch(): boolean {
  const e = env();
  if (e.SEARCH_PROVIDER === 'tavily') return !!e.TAVILY_API_KEY;
  if (e.SEARCH_PROVIDER === 'exa') return !!e.EXA_API_KEY;
  if (e.SEARCH_PROVIDER === 'searxng') return true;
  return false;
}

/** True when a CRM push target is configured. Otherwise pushes are a safe no-op. */
export function hasCrm(): boolean {
  const e = env();
  if (!e.ENABLE_CRM || e.CRM_PROVIDER === 'none') return false;
  if (e.CRM_PROVIDER === 'hubspot') return !!e.HUBSPOT_API_KEY;
  if (e.CRM_PROVIDER === 'salesforce') return !!(e.SALESFORCE_INSTANCE_URL && e.SALESFORCE_ACCESS_TOKEN);
  return false;
}

/** True when paid contact enrichment is enabled and a vendor key is present. */
export function hasEnrichment(): boolean {
  const e = env();
  if (!e.ENABLE_PAID_ENRICHMENT) return false;
  return !!(e.APOLLO_API_KEY || e.PDL_API_KEY);
}

/** True when S3 flat-file delivery is fully configured. */
export function hasS3(): boolean {
  const e = env();
  return !!(e.S3_BUCKET && e.AWS_ACCESS_KEY_ID && e.AWS_SECRET_ACCESS_KEY);
}
