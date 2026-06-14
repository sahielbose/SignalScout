import { z } from 'zod';
import { generateObject } from 'ai';
import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { dossiers, people } from '@/lib/db/schema';
import { resolvePerson } from '@/lib/entity/resolution';
import { getModel, modelId, logLlmRun } from '@/lib/providers/llm';
import { type Dossier, type Fact } from '@/lib/types';
import { searchWeb, fetchPage, githubLookup, type GithubProfile } from './tools';
import { enforceCitations, type GuardedDossier } from './dossier';
import { stripDashes } from '@/lib/utils';

const PROMPT_VERSION = 'dossier-v1';
const GH_ATTRIBUTION_MIN = 0.5;
const MAX_PAGE_FETCHES = 3;
const CACHE_DAYS = 7;

const TOS_BLOCKED = new Set(['linkedin.com', 'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com']);

export interface DossierInput {
  name: string;
  company?: string | null;
  domain?: string | null;
  linkedinUrl?: string | null;
  githubLogin?: string | null;
  title?: string | null;
  personId?: string | null;
  orgId?: string | null;
  /** A user's bring-your-own Anthropic key - routes LLM spend to them. */
  llmApiKey?: string | null;
  force?: boolean;
}

export interface DossierResult {
  dossier: GuardedDossier;
  personId: string | null;
  model: string;
  costUsd: number;
  toolCalls: number;
  cached: boolean;
}

function host(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function getCachedDossier(personId: string, orgId: string | null | undefined): Promise<GuardedDossier | null> {
  // Tenancy: a cached dossier is private to the org that built it. With no org we
  // fail closed (never serve another org's cached research from the shared person).
  if (!orgId) return null;
  const [row] = await db
    .select()
    .from(dossiers)
    .where(and(eq(dossiers.personId, personId), eq(dossiers.orgId, orgId), gt(dossiers.expiresAt, new Date())))
    .orderBy(desc(dossiers.createdAt))
    .limit(1);
  if (!row || !row.structured) return null;
  return {
    identity: { full_name: '', company: undefined },
    tags: row.tags,
    structured: row.structured,
    summary: row.summary ?? undefined,
    why_they_care: row.whyTheyCare ?? '',
    suggested_opener: row.suggestedOpener ?? '',
    confidence: row.confidence,
    lowConfidence: row.lowConfidence,
    sources: row.sources,
  } as unknown as GuardedDossier;
}

// ───────────────────────── deterministic (no-key) dossier ─────────────────────────
function focusFromRepos(gh: GithubProfile): string {
  const langs = [...new Set(gh.topRepos.map((r) => r.language).filter(Boolean))].slice(0, 3);
  const top = gh.topRepos[0];
  return langs.length ? `${langs.join(', ')}${top?.name ? ` - e.g. ${top.name}` : ''}` : (top?.name ?? 'software');
}

function tagsFromGithub(gh: GithubProfile): string[] {
  const langs = gh.topRepos.map((r) => r.language).filter((x): x is string => !!x);
  return [...new Set(langs)].slice(0, 4);
}

function buildMockDossier(input: DossierInput, gh: GithubProfile | null): Dossier {
  const structured: Dossier['structured'] = {};
  let tags: string[] = [];
  const trusted = gh && gh.matchConfidence >= GH_ATTRIBUTION_MIN;

  if (trusted && gh) {
    const src = gh.profileUrl;
    const snip = (gh.bio || `${gh.name ?? gh.login} - GitHub profile`).slice(0, 200);
    structured.github_contributions = {
      value: `${gh.publicRepos} public repositories · ${gh.followers} followers`,
      source_url: src,
      snippet: snip,
    };
    if (gh.company) structured.company = { value: gh.company.replace(/^@/, ''), source_url: src, snippet: snip };
    if (input.title || gh.bio) structured.role = { value: (input.title || gh.bio)!.slice(0, 120), source_url: src, snippet: snip };
    if (gh.topRepos[0]) {
      const r = gh.topRepos[0];
      structured.focus = { value: focusFromRepos(gh), source_url: r.url, snippet: (r.description || r.name).slice(0, 200) };
    }
    structured.starred_repos = gh.starredRepos.slice(0, 6).map((s) => ({ value: s.name, source_url: s.url, snippet: `Starred ${s.name}` }));
    tags = tagsFromGithub(gh);
  }

  const company = input.company ?? gh?.company?.replace(/^@/, '') ?? undefined;
  const focusVal = structured.focus?.value;
  const summary = trusted && gh
    ? `${input.name}${company ? ` at ${company}` : ''} has a public technical footprint on GitHub (${gh.publicRepos} repos, ${gh.followers} followers)${focusVal ? `, working around ${focusVal}` : ''}. Profile: ${gh.profileUrl}.`
    : `Limited public technical footprint found for ${input.name}${company ? ` at ${company}` : ''}. This dossier is low-confidence - connect a search provider or supply a GitHub handle / LinkedIn URL for more.`;

  return {
    identity: {
      full_name: input.name,
      title: input.title ?? gh?.bio?.slice(0, 80) ?? undefined,
      company,
      location: gh?.location ?? undefined,
    },
    tags,
    structured,
    why_they_care: focusVal
      ? `They work hands-on with ${focusVal}, so messaging that speaks to that workflow will land.`
      : `Identify their current focus before reaching out - this profile is thin on public signal.`,
    suggested_opener: focusVal
      ? `Saw your work around ${focusVal} - curious how you're thinking about it lately.`
      : `Would love to learn what you're focused on right now.`,
    confidence: 0,
  };
}

// ───────────────────────── LLM-synthesized dossier ─────────────────────────
const FactSchema = z.object({ value: z.string(), source_url: z.string(), snippet: z.string() });
const LlmDossierSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).max(8).default([]),
  structured: z.object({
    role: FactSchema.optional(),
    company: FactSchema.optional(),
    github_contributions: FactSchema.optional(),
    focus: FactSchema.optional(),
    talks: z.array(FactSchema).max(5).optional(),
    publications: z.array(FactSchema).max(5).optional(),
    starred_repos: z.array(FactSchema).max(8).optional(),
  }),
  summary: z.string(),
  why_they_care: z.string(),
  suggested_opener: z.string(),
});

interface Evidence {
  url: string;
  title: string;
  content: string;
}

async function buildLlmDossier(
  input: DossierInput,
  gh: GithubProfile | null,
  evidence: Evidence[],
  orgId?: string | null,
): Promise<{ dossier: Dossier; costUsd: number; model: string } | null> {
  const model = getModel('research', input.llmApiKey);
  if (!model) return null;

  const ghBlock = gh && gh.matchConfidence >= GH_ATTRIBUTION_MIN ? gh : null;
  const allowed = new Set<string>([...evidence.map((e) => e.url)]);
  if (ghBlock) {
    allowed.add(ghBlock.profileUrl);
    ghBlock.topRepos.forEach((r) => allowed.add(r.url));
    ghBlock.starredRepos.forEach((r) => allowed.add(r.url));
  }

  const evidenceText = [
    ghBlock
      ? `GITHUB PROFILE (matchConfidence ${ghBlock.matchConfidence.toFixed(2)}) ${ghBlock.profileUrl}\n` +
        `name=${ghBlock.name} company=${ghBlock.company} location=${ghBlock.location} repos=${ghBlock.publicRepos} followers=${ghBlock.followers}\n` +
        `bio: ${ghBlock.bio ?? ''}\n` +
        `top repos: ${ghBlock.topRepos.map((r) => `${r.name} (${r.language ?? '?'}) ${r.url} - ${r.description ?? ''}`).join(' | ')}\n` +
        `starred: ${ghBlock.starredRepos.map((r) => `${r.name} ${r.url}`).join(' | ')}`
      : `No confident GitHub match.`,
    ...evidence.map((e) => `SOURCE ${e.url}\nTITLE ${e.title}\n${e.content}`),
  ].join('\n\n---\n\n');

  const t0 = Date.now();
  const { object, usage } = await generateObject({
    model,
    schema: LlmDossierSchema,
    temperature: 0.2,
    maxRetries: 1,
    system:
      `You are a meticulous B2B research analyst building a dossier on a person for a sales rep.\n` +
      `RULES:\n` +
      `- Every factual field MUST have a source_url that is one of the EXACT urls in the EVIDENCE, plus a verbatim snippet from that source.\n` +
      `- If the evidence does not support a field, OMIT it. Never guess.\n` +
      `- Do NOT attribute GitHub repos/activity unless the GitHub match is confident and consistent with the person.\n` +
      `- why_they_care and suggested_opener are your own prose (no citation needed) but must follow from cited facts.`,
    prompt: `PERSON: ${input.name}${input.company ? ` at ${input.company}` : ''}${input.title ? ` (${input.title})` : ''}\n\nEVIDENCE:\n${evidenceText}\n\nProduce the dossier JSON.`,
  });
  const costModel = modelId('research');
  await logLlmRun({
    orgId,
    kind: 'dossier',
    model: costModel,
    promptVersion: PROMPT_VERSION,
    input: { name: input.name, company: input.company, evidenceUrls: [...allowed] },
    output: { tags: object.tags },
    inputTokens: usage?.promptTokens,
    outputTokens: usage?.completionTokens,
    latencyMs: Date.now() - t0,
  });

  // restrict every fact's source_url to the allowed evidence set (anti-hallucination)
  const restrict = (f?: Fact) => (f && allowed.has(f.source_url) ? f : undefined);
  const restrictArr = (a?: Fact[]) => (a ?? []).filter((f) => allowed.has(f.source_url));
  const dossier: Dossier = {
    identity: { full_name: input.name, title: object.title, company: object.company ?? input.company ?? undefined, location: object.location },
    tags: object.tags,
    structured: {
      role: restrict(object.structured.role),
      company: restrict(object.structured.company),
      github_contributions: restrict(object.structured.github_contributions),
      focus: restrict(object.structured.focus),
      talks: restrictArr(object.structured.talks),
      publications: restrictArr(object.structured.publications),
      starred_repos: restrictArr(object.structured.starred_repos),
    },
    summary: object.summary,
    why_they_care: object.why_they_care,
    suggested_opener: object.suggested_opener,
    confidence: 0,
  };
  const cost = usage ? estimateResearchCost(costModel, usage.promptTokens ?? 0, usage.completionTokens ?? 0) : 0;
  return { dossier, costUsd: cost, model: costModel };
}

function estimateResearchCost(model: string, inTok: number, outTok: number): number {
  if (/sonnet/i.test(model)) return (inTok / 1e6) * 3 + (outTok / 1e6) * 15;
  if (/opus/i.test(model)) return (inTok / 1e6) * 5 + (outTok / 1e6) * 25;
  if (/haiku/i.test(model)) return (inTok / 1e6) * 1 + (outTok / 1e6) * 5;
  return 0;
}

// ───────────────────────────── orchestrator ─────────────────────────────
export async function generateDossier(input: DossierInput): Promise<DossierResult> {
  // ensure a person row to attach to (also connects /research → /people/[id])
  let personId = input.personId ?? null;
  if (!personId) {
    personId = await resolvePerson({
      fullName: input.name,
      linkedinUrl: input.linkedinUrl,
      githubLogin: input.githubLogin,
      title: input.title,
    });
  }

  if (personId && !input.force) {
    const cached = await getCachedDossier(personId, input.orgId);
    if (cached) {
      cached.identity = {
        full_name: input.name,
        title: input.title ?? cached.identity.title,
        company: input.company ?? cached.identity.company,
        location: cached.identity.location,
      };
      return { dossier: cached, personId, model: 'cache', costUsd: 0, toolCalls: 0, cached: true };
    }
  }

  let toolCalls = 0;
  // 1) GitHub (tool)
  const gh = await githubLookup({ name: input.name, company: input.company, domain: input.domain, githubLogin: input.githubLogin });
  toolCalls++;

  // 2) Web search + fetch (tools), ToS-blocked domains skipped, never fetch LinkedIn/X
  const evidence: Evidence[] = [];
  const results = (await searchWeb(`${input.name} ${input.company ?? ''}`.trim())).filter((r) => !TOS_BLOCKED.has(host(r.url)));
  toolCalls++;
  for (const r of results.slice(0, MAX_PAGE_FETCHES)) {
    const page = await fetchPage(r.url);
    toolCalls++;
    if (page.ok && page.text.length > 80) evidence.push({ url: page.url, title: page.title, content: page.text.slice(0, 1500) });
  }

  // 3) synthesize - use a real model (env or BYO key) when available, else mock
  let raw: Dossier;
  let model = 'mock';
  let costUsd = 0;
  const llm = await buildLlmDossier(input, gh, evidence, input.orgId).catch(() => null);
  if (llm) {
    raw = llm.dossier;
    model = llm.model;
    costUsd = llm.costUsd;
  } else {
    raw = buildMockDossier(input, gh);
    await logLlmRun({ orgId: input.orgId, kind: 'dossier', model: 'mock', promptVersion: PROMPT_VERSION, input: { name: input.name }, output: { tags: raw.tags }, latencyMs: 0 });
  }

  // 4) citation guard
  const guarded = enforceCitations(raw);

  // house style: no em dashes in generated prose (cited snippets stay verbatim)
  guarded.summary = guarded.summary ? stripDashes(guarded.summary) : guarded.summary;
  guarded.why_they_care = stripDashes(guarded.why_they_care);
  guarded.suggested_opener = stripDashes(guarded.suggested_opener);
  guarded.tags = guarded.tags.map(stripDashes);

  // 5) persist (cache)
  if (personId) {
    await db.insert(dossiers).values({
      personId,
      orgId: input.orgId ?? null,
      summary: guarded.summary ?? null,
      structured: guarded.structured,
      sources: guarded.sources,
      tags: guarded.tags,
      whyTheyCare: guarded.why_they_care,
      suggestedOpener: guarded.suggested_opener,
      confidence: guarded.confidence,
      lowConfidence: guarded.lowConfidence,
      model,
      promptVersion: PROMPT_VERSION,
      toolCalls,
      costUsd,
      expiresAt: new Date(Date.now() + CACHE_DAYS * 86400_000),
    });
    // keep the person's headline fields fresh
    await db.update(people).set({ title: input.title ?? guarded.identity.title ?? undefined, updatedAt: new Date() }).where(eq(people.id, personId));
  }

  return { dossier: guarded, personId, model, costUsd, toolCalls, cached: false };
}
