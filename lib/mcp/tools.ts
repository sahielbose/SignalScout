import { z } from 'zod';
import { and, arrayOverlaps, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signals, companies } from '@/lib/db/schema';
import { getFeed, getOrgIcpIds } from '@/lib/feed/queries';
import { getPersonWithDossier, personVisibleToOrg } from '@/lib/research/people-queries';
import { generateDossier } from '@/lib/research/agent';
import { getListMembers, listLists, createList, addPersonToList } from '@/lib/lists/service';
import { listIcps } from '@/lib/icp/service';
import { listCompaniesWithCounts } from '@/lib/companies/queries';
import { getEvents } from '@/lib/events/queries';
import { toCsv } from '@/lib/delivery/csv';
import { normalizeDomain, normalizeCompanyName } from '@/lib/entity/normalize';
import { SignalTypeSchema, SourceSchema, type IcpDefinition } from '@/lib/types';

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

/** Build a short, human-readable one-line summary of an ICP definition. */
function summarizeIcpDefinition(def: IcpDefinition): string {
  const parts: string[] = [];
  if (def.industries?.length) parts.push(`industries: ${def.industries.join(', ')}`);
  if (def.titles?.length) parts.push(`titles: ${def.titles.join(', ')}`);
  if (def.companySize) parts.push(`size: ${def.companySize}`);
  if (def.geos?.length) parts.push(`geos: ${def.geos.join(', ')}`);
  if (def.signalTypes?.length) parts.push(`signals: ${def.signalTypes.join(', ')}`);
  if (def.keywords?.length) parts.push(`keywords: ${def.keywords.join(', ')}`);
  return parts.join('; ') || 'no criteria set';
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
    async handle(args, orgId) {
      // Tenancy: signals are a shared pool matched per org. Only return signals
      // matched to THIS org's ICPs, mirroring the dashboard company queries.
      const orgIcpIds = await getOrgIcpIds(orgId);
      if (orgIcpIds.length === 0) return { error: 'no_icps' };
      const company = await resolveCompany({ companyId: args.companyId as string, domain: args.domain as string, name: args.name as string });
      if (!company) return { error: 'company_not_found' };
      const limit = typeof args.limit === 'number' ? args.limit : 20;
      const rows = await db
        .select({ id: signals.id, type: signals.type, strength: signals.strength, source: signals.source, title: signals.title, url: signals.sourceUrl, publishedAt: signals.publishedAt, ingestedAt: signals.ingestedAt })
        .from(signals)
        .where(and(eq(signals.companyId, company.id), arrayOverlaps(signals.matchedIcpIds, orgIcpIds)))
        .orderBy(desc(sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt})`))
        .limit(limit);
      // Fail closed: if the company has no signals matched to this org, do not
      // confirm the company even exists.
      if (rows.length === 0) return { error: 'company_not_found' };
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
  {
    name: 'list_icps',
    description: "List the connected org's Ideal Customer Profiles (ICPs). Returns each ICP id, name, whether it is active, and a short summary of its definition.",
    schema: {},
    async handle(_args, orgId) {
      const rows = await listIcps(orgId);
      return {
        icps: rows.map((r) => ({
          id: r.id,
          name: r.name,
          active: r.active,
          definition: summarizeIcpDefinition(r.definition as IcpDefinition),
        })),
      };
    },
  },
  {
    name: 'list_companies',
    description: "List the connected org's tracked companies (those with ICP-matched signals), ranked by signal volume. Returns id, name, domain, signal count, and most-recent signal time.",
    schema: { limit: z.number().int().min(1).max(100).optional() },
    async handle(args, orgId) {
      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const rows = await listCompaniesWithCounts(orgId, { limit });
      return {
        companies: rows.map((c) => ({
          id: c.id,
          name: c.name,
          domain: c.domain,
          signals: c.signals,
          last_at: c.lastAt,
        })),
      };
    },
  },
  {
    name: 'list_events',
    description: "List the connected org's upcoming/recent event signals (conferences, meetups) matched to its ICPs. Returns event title, company, linked ICP-matched attendee (if any), strength, date, and url.",
    schema: { limit: z.number().int().min(1).max(50).optional() },
    async handle(args, orgId) {
      const limit = typeof args.limit === 'number' ? args.limit : 20;
      const rows = await getEvents(orgId);
      return {
        events: rows.slice(0, limit).map((e) => ({
          id: e.id,
          title: e.title,
          source: e.source,
          strength: e.strength,
          company: e.companyName,
          domain: e.companyDomain,
          person_id: e.personId,
          person: e.personName,
          person_title: e.personTitle,
          url: e.sourceUrl,
          why: e.justification,
          date: e.date ?? e.ingestedAt,
        })),
      };
    },
  },
  {
    name: 'add_person_to_list',
    description: 'Add a person to a saved list for the connected org, creating the list by name if it does not exist. Returns the list id and the new member count. Idempotent: re-adding the same person does not duplicate.',
    schema: { personId: z.string(), listName: z.string() },
    async handle(args, orgId) {
      const personId = String(args.personId);
      // Tenancy: only attach a person this org can already see (a dossier, list
      // membership, or org-matched signal). Otherwise an arbitrary id could pull
      // a cross-tenant person into this org's visibility.
      if (!(await personVisibleToOrg(orgId, personId))) return { error: 'person_not_found' };
      const listName = String(args.listName).trim();
      const wanted = listName.toLowerCase();
      const existing = await listLists(orgId);
      let list = existing.find((l) => (l.name ?? '').trim().toLowerCase() === wanted);
      let created = false;
      if (!list) {
        const row = await createList(orgId, listName);
        if (!row) return { error: 'list_create_failed' };
        list = { id: row.id, name: row.name, createdAt: row.createdAt, members: 0 };
        created = true;
      }
      const ok = await addPersonToList(orgId, list.id, personId);
      if (!ok) return { error: 'list_not_found' };
      const members = await getListMembers(orgId, list.id);
      return {
        list_id: list.id,
        list_name: list.name,
        created,
        member_count: members.length,
      };
    },
  },
];

export function getTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}
