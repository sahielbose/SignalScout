import { z } from 'zod';

// ───────────────────────── signal taxonomy ─────────────────────────
export const SIGNAL_TYPES = [
  'funding',
  'incorporation',
  'hiring',
  'product_launch',
  'buying_intent',
  'expansion',
  'thought_leadership',
  'event',
  'sec_filing',
  'github_release',
  'content',
  'partnership',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];
export const SignalTypeSchema = z.enum(SIGNAL_TYPES);

export const SOURCES = [
  'sec',
  'greenhouse',
  'lever',
  'ashby',
  'github',
  'web',
  'luma',
  'hackernews',
  'producthunt',
] as const;
export type SourceName = (typeof SOURCES)[number];
export const SourceSchema = z.enum(SOURCES);

// ─────────────────────────── RawItem (§5a) ─────────────────────────
export const ActorSchema = z.object({
  kind: z.enum(['company', 'person']),
  name: z.string().min(1),
  domain: z.string().optional(),
  linkedinUrl: z.string().optional(),
  email: z.string().optional(),
  githubLogin: z.string().optional(),
  title: z.string().optional(),
  location: z.string().optional(),
});
export type Actor = z.infer<typeof ActorSchema>;

export const RawItemSchema = z.object({
  source: SourceSchema,
  externalId: z.string().min(1), // stable id from the source
  url: z.string(),
  publishedAt: z.string().optional(), // ISO
  actor: ActorSchema,
  title: z.string().optional(),
  text: z.string(), // human-readable content to classify
  /** Optional hint from the adapter; the classifier still decides the final type. */
  hintType: SignalTypeSchema.optional(),
  meta: z.record(z.unknown()).optional(),
});
export type RawItem = z.infer<typeof RawItemSchema>;

// ───────────────────────── ICP definition ──────────────────────────
/**
 * Company-size buckets, by number of employees. Offered as a clear multi-select
 * in the ICP form (a single free-text "11-200" was easy to mistype). Stored as a
 * comma-joined string in `companySize` so the existing storage stays unchanged.
 */
export const COMPANY_SIZE_RANGES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;
export type CompanySizeRange = (typeof COMPANY_SIZE_RANGES)[number];

export const IcpDefinitionSchema = z.object({
  industries: z.array(z.string()).default([]),
  titles: z.array(z.string()).default([]),
  companySize: z.string().optional(), // e.g. "11-50", "51-200", "1000+"
  keywords: z.array(z.string()).default([]),
  /**
   * Words that DISQUALIFY a company. If a public buying moment's text contains any
   * of these, it does NOT match this profile, even when other keywords line up.
   * Use it to filter out look-alikes (for example "recruiting", "job board").
   */
  excludeKeywords: z.array(z.string()).optional(),
  geos: z.array(z.string()).default([]),
  signalTypes: z.array(SignalTypeSchema).default([]),
  notify: z
    .object({
      email: z.boolean().default(false),
      slack: z.boolean().default(false),
    })
    .default({ email: false, slack: false }),
  notifyThreshold: z.number().min(0).max(1).default(0.7),
});
export type IcpDefinition = z.infer<typeof IcpDefinitionSchema>;

// ───────────────── classifier output (LLM, validated) ──────────────
export const ClassificationSchema = z.object({
  type: SignalTypeSchema,
  strength: z.number().min(0).max(1),
  matchedIcpIds: z.array(z.string()).default([]),
  justification: z.string().max(400),
});
export type Classification = z.infer<typeof ClassificationSchema>;

/** Stored on signals.classification (meta about the run, not the result alone). */
export type SignalClassificationMeta = Partial<{
  justification: string;
  model: string;
  promptVersion: string;
  prefilterScore: number;
  /** Adapter's type hint, carried through ingestion as a prior for the classifier. */
  hint: SignalType;
}>;

// ───────────────────────── dossier (cited) ─────────────────────────
export const FactSchema = z.object({
  value: z.string(),
  source_url: z.string(),
  snippet: z.string(),
});
export type Fact = z.infer<typeof FactSchema>;

export const DossierStructuredSchema = z.object({
  role: FactSchema.optional(),
  company: FactSchema.optional(),
  github_contributions: FactSchema.optional(),
  focus: FactSchema.optional(),
  talks: z.array(FactSchema).optional(),
  publications: z.array(FactSchema).optional(),
  starred_repos: z.array(FactSchema).optional(),
});
export type DossierStructured = z.infer<typeof DossierStructuredSchema>;

export const DossierSchema = z.object({
  identity: z.object({
    full_name: z.string(),
    title: z.string().optional(),
    company: z.string().optional(),
    location: z.string().optional(),
  }),
  tags: z.array(z.string()).default([]),
  structured: DossierStructuredSchema,
  summary: z.string().optional(),
  why_they_care: z.string(),
  suggested_opener: z.string(),
  confidence: z.number().min(0).max(1).default(0),
});
export type Dossier = z.infer<typeof DossierSchema>;

export type DossierSource = { claim: string; url: string; snippet: string };

// ───────────────────────── pretty labels ───────────────────────────
export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  funding: 'Funding',
  incorporation: 'Incorporation',
  hiring: 'Hiring',
  product_launch: 'Product Launch',
  buying_intent: 'Buying Intent',
  expansion: 'Expansion',
  thought_leadership: 'Thought Leadership',
  event: 'Event',
  sec_filing: 'SEC Filing',
  github_release: 'GitHub Release',
  content: 'Content',
  partnership: 'Partnership',
};

export const SOURCE_LABELS: Record<SourceName, string> = {
  sec: 'SEC EDGAR',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  github: 'GitHub',
  web: 'Web',
  luma: 'lu.ma',
  hackernews: 'Hacker News',
  producthunt: 'Product Hunt',
};
