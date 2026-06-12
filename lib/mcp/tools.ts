import { z } from 'zod';
import { desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signals, companies } from '@/lib/db/schema';
import { getFeed } from '@/lib/feed/queries';
import { getPersonWithDossier } from '@/lib/research/people-queries';
import { generateDossier } from '@/lib/research/agent';
import { getListMembers } from '@/lib/lists/service';
import { toCsv } from '@/lib/delivery/csv';
import { normalizeDomain, normalizeCompanyName } from '@/lib/entity/normalize';
import { SignalTypeSchema, SourceSchema } from '@/lib/types';

export interface McpTool {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handle: (args: Record<string, unknown>, orgId: string) => Promise<unknown>;
}

async function resolveCompany(input: { companyId?: string; domain?: string; name?: string }) {
  if (input.companyId) {
    const [c] = await db.select().from(companies).where(eq(companies.id, input.companyId)).limit(1);
    return c ?? null;
  }
  const domain = normalizeDomain(input.domain);
  const normName = normalizeCompanyName(input.name);
  const [c] = await db
    .select()
    .from(companies)
    .where(or(domain ? eq(companies.domain, domain) : undefined, normName ? eq(companies.normalizedName, normName) : undefined))
    .limit(1);
  return c ?? null;
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'search_signals',
    description:
      'Search the live, ICP-matched buying-signal feed for the connected org. Filter by signal type, source, minimum strength, and recency.',
    schema: {
      type: z.enum(['funding', 'hiring', 'product_launch', 'buying_intent', 'expansion', 'thought_leadership', 'event', 'sec_filing', 'github_release', 'content', 'partnership']).optional(),
      source: z.enum(['sec', 'greenhouse', 'lever', 'ashby', 'github', 'web', 'luma']).optional(),
      minStrength: z.number().min(0).max(1).optional(),
      sinceDays: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async handle(args, orgId) {
      const type = SignalTypeSchema.safeParse(args.type);
      const source = SourceSchema.safeParse(args.source);
      const { items } = await getFeed(orgId, {
        type: type.success ? type.data : undefined,
        source: source.success ? source.data : undefined,
        minStrength: typeof args.minStrength === 'number' ? args.minStrength : undefined,
        sinceDays: typeof args.sinceDays === 'number' ? args.sinceDays : undefined,
      });
      const limit = typeof args.limit === 'number' ? args.limit : 15;
      return {
        signals: items.slice(0, limit).map((s) => ({
          id: s.id,
          type: s.type,
          strength: s.strength,
          source: s.source,
          title: s.title,
          company: s.companyName,
          domain: s.companyDomain,
          url: s.sourceUrl,
          why: s.justification,
          published_at: s.publishedAt ?? s.ingestedAt,
        })),
      };
    },
  },
  {
    name: 'get_person',
    description: 'Get a person and their cited research dossier (if one exists for this org) by person id.',
    schema: { personId: z.string() },
    async handle(args, orgId) {
      const ctx = await getPersonWithDossier(orgId, String(args.personId));
      if (!ctx) return { error: 'not_found' };
      return {
        person: { id: ctx.person.id, name: ctx.person.fullName, title: ctx.person.title, company: ctx.companyName, location: ctx.person.location },
        dossier: ctx.dossier
          ? { confidence: ctx.dossier.confidence, low_confidence: ctx.dossier.lowConfidence, tags: ctx.dossier.tags, summary: ctx.dossier.summary, structured: ctx.dossier.structured, sources: ctx.dossier.sources }
          : null,
      };
    },
  },
  {
    name: 'generate_dossier',
    description:
      'Run deep research on a person and return a CITED dossier. Every factual field carries a source url; uncited claims are dropped and low-confidence results are flagged. Provide a name + company, or a github handle / linkedin url.',
    schema: {
      name: z.string(),
      company: z.string().optional(),
      domain: z.string().optional(),
      githubLogin: z.string().optional(),
      linkedinUrl: z.string().optional(),
      force: z.boolean().optional(),
    },
    async handle(args, orgId) {
      const r = await generateDossier({
        name: String(args.name),
        company: (args.company as string) ?? null,
        domain: (args.domain as string) ?? null,
        githubLogin: (args.githubLogin as string) ?? null,
        linkedinUrl: (args.linkedinUrl as string) ?? null,
        orgId,
        force: args.force === true,
      });
      return {
        person_id: r.personId,
        confidence: r.dossier.confidence,
        low_confidence: r.dossier.lowConfidence,
        identity: r.dossier.identity,
        tags: r.dossier.tags,
        summary: r.dossier.summary,
        structured: r.dossier.structured,
        why_they_care: r.dossier.why_they_care,
        suggested_opener: r.dossier.suggested_opener,
        sources: r.dossier.sources,
      };
    },
  },
  {
    name: 'list_signals_for_company',
    description: 'List recent public signals for a company, found by company id, domain, or name.',
    schema: {
      companyId: z.string().optional(),
      domain: z.string().optional(),
      name: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async handle(args, _orgId) {
      const company = await resolveCompany({ companyId: args.companyId as string, domain: args.domain as string, name: args.name as string });
      if (!company) return { error: 'company_not_found' };
      const limit = typeof args.limit === 'number' ? args.limit : 20;
      const rows = await db
        .select({ id: signals.id, type: signals.type, strength: signals.strength, source: signals.source, title: signals.title, url: signals.sourceUrl, publishedAt: signals.publishedAt, ingestedAt: signals.ingestedAt })
        .from(signals)
        .where(eq(signals.companyId, company.id))
        .orderBy(desc(sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt})`))
        .limit(limit);
      return { company: { id: company.id, name: company.name, domain: company.domain }, signals: rows };
    },
  },
  {
    name: 'export_list',
    description: 'Export a saved list as CSV text (people and companies with their enrichment).',
    schema: { listId: z.string(), format: z.enum(['csv', 'json']).optional() },
    async handle(args, orgId) {
      const members = await getListMembers(orgId, String(args.listId));
      if (args.format === 'json') return { members };
      const headers = ['type', 'name', 'title', 'company', 'domain', 'linkedin_url', 'github_login', 'location'];
      const csv = toCsv(
        headers,
        members.map((m) => [m.kind, m.name, m.title, m.companyName, m.domain, m.linkedinUrl, m.githubLogin, m.location]),
      );
      return { csv, count: members.length };
    },
  },
];

export function getTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}
