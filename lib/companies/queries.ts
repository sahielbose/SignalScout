import { and, desc, asc, eq, gte, ilike, or, sql, arrayOverlaps, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { companies, signals, people } from '@/lib/db/schema';
import { getOrgIcpIds } from '@/lib/feed/queries';

/** Ways to order the companies index. Kept as a closed set so the URL param is validated. */
export const COMPANY_SORTS = ['recent', 'signals', 'name'] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];

export interface CompaniesListOptions {
  /** Free-text match on the company name or domain (case-insensitive substring). */
  search?: string;
  /** Keep only companies that have at least one matched signal of this type. */
  type?: string;
  /** Keep only companies with at least this many matched signals. */
  minSignals?: number;
  /** recent = most recently seen, signals = most signals, name = A-Z. */
  sort?: CompanySort;
  limit?: number;
}

export async function listCompaniesWithCounts(
  orgId: string,
  options: CompaniesListOptions = {},
): Promise<{ id: string; name: string | null; domain: string | null; signals: number; lastAt: Date | null }[]> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  // No ICPs yet -> nothing matched, so no companies to show.
  if (orgIcpIds.length === 0) return [];

  const { search, type, minSignals, sort = 'signals', limit = 100 } = options;

  // Join scope: only signals matched to one of the org's ICPs (tenancy scope).
  const joinConds: SQL[] = [
    eq(signals.companyId, companies.id),
    arrayOverlaps(signals.matchedIcpIds, orgIcpIds),
  ];
  // Signal-type filter is applied on the join so a company only survives when it
  // actually has a matched signal of that type (and the count reflects that type).
  if (type) joinConds.push(eq(signals.type, type));

  // Name/domain search lives on the row, not the join, so it does not change counts.
  const where: SQL | undefined = search
    ? or(ilike(companies.name, `%${search}%`), ilike(companies.domain, `%${search}%`))
    : undefined;

  const countExpr = sql<number>`count(${signals.id})`;
  const lastAtExpr = sql<Date | null>`max(coalesce(${signals.publishedAt}, ${signals.ingestedAt}))`;

  // "At least N signals" is a post-aggregation filter -> HAVING, not WHERE.
  const having =
    minSignals != null && minSignals > 1 ? gte(countExpr, minSignals) : undefined;

  const orderBy =
    sort === 'name'
      ? asc(sql`lower(coalesce(${companies.name}, ${companies.domain}, ''))`)
      : sort === 'recent'
        ? desc(lastAtExpr)
        : desc(countExpr);

  return db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
      signals: sql<number>`count(${signals.id})::int`,
      lastAt: lastAtExpr,
    })
    .from(companies)
    .innerJoin(signals, and(...joinConds))
    .where(where)
    .groupBy(companies.id)
    .having(having)
    .orderBy(orderBy)
    .limit(limit);
}

/**
 * Distinct signal types that this org actually has on its companies, for the
 * type filter dropdown. Org-scoped: only counts signals matched to the org's ICPs.
 */
export async function getCompanyFacets(orgId: string): Promise<{ types: string[] }> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  if (orgIcpIds.length === 0) return { types: [] };
  const rows = await db
    .selectDistinct({ type: signals.type })
    .from(signals)
    .where(and(sql`${signals.type} is not null`, arrayOverlaps(signals.matchedIcpIds, orgIcpIds)));
  return { types: rows.map((r) => r.type).filter((t): t is string => !!t).sort() };
}

export function inferDepartment(title?: string | null): string {
  const t = (title ?? '').toLowerCase();
  if (/\b(ceo|cto|cfo|coo|founder|chief|president)\b/.test(t)) return 'Leadership';
  if (/\b(sales|account exec|revenue|gtm|go-to-market|business develop|partnership|customer success|sdr|bdr)\b/.test(t)) return 'Go-to-Market';
  if (/\b(engineer|developer|infra|backend|frontend|sre|devops|data|ml|ai|security|platform)\b/.test(t)) return 'Engineering';
  if (/\b(product|design|ux|ui)\b/.test(t)) return 'Product & Design';
  if (/\b(market|growth|brand|content|demand)\b/.test(t)) return 'Marketing';
  if (/\b(finance|account|legal|people|hr|recruit|ops|operations|talent)\b/.test(t)) return 'Operations';
  return 'Other';
}

export interface CompanyPerson {
  id: string;
  name: string;
  title: string | null;
}

export interface CompanyProfile {
  company: typeof companies.$inferSelect;
  timeline: {
    id: string;
    type: string | null;
    strength: number | null;
    title: string | null;
    source: string;
    url: string | null;
    publishedAt: Date | null;
    ingestedAt: Date;
  }[];
  byType: { type: string; count: number }[];
  /** Flat, org-scoped list of people at this company (ordered by confidence). */
  people: CompanyPerson[];
  departments: { name: string; people: CompanyPerson[] }[];
}

export async function getCompanyProfile(
  orgId: string,
  companyId: string,
  options: { type?: string } = {},
): Promise<CompanyProfile | null> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  // No ICPs yet -> no matched signals, so nothing to show for this org.
  if (orgIcpIds.length === 0) return null;

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return null;

  // Org scope: only signals matched to one of the org's ICPs.
  const orgScope = and(
    eq(signals.companyId, companyId),
    arrayOverlaps(signals.matchedIcpIds, orgIcpIds),
  );

  // Visibility is decided by all org-matched signals (byType totals stay complete),
  // so the timeline type filter is applied on top of the org scope, not in place of it.
  const timelineScope = options.type ? and(orgScope, eq(signals.type, options.type)) : orgScope;

  // Gate visibility on the unfiltered org scope: a company the org can see should
  // not 404 just because the active type filter has no matches.
  const [visible] = await db
    .select({ id: signals.id })
    .from(signals)
    .where(orgScope)
    .limit(1);
  if (!visible) return null;

  const timeline = await db
    .select({
      id: signals.id,
      type: signals.type,
      strength: signals.strength,
      title: signals.title,
      source: signals.source,
      url: signals.sourceUrl,
      publishedAt: signals.publishedAt,
      ingestedAt: signals.ingestedAt,
    })
    .from(signals)
    .where(timelineScope)
    .orderBy(desc(sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt})`))
    .limit(100);

  // byType and people are independent; run them together (we only reach here for a
  // visible company). byType always uses the unfiltered org scope so the per-type
  // counts shown as filter chips stay complete regardless of the active type filter.
  const [byTypeRows, peopleRows] = await Promise.all([
    db
      .select({ type: signals.type, count: sql<number>`count(*)::int` })
      .from(signals)
      .where(orgScope)
      .groupBy(signals.type),
    db
      .select({ id: people.id, name: people.fullName, title: people.title })
      .from(people)
      .where(eq(people.companyId, companyId))
      .orderBy(desc(people.confidence)),
  ]);
  const byType = byTypeRows
    .filter((r): r is { type: string; count: number } => !!r.type)
    .sort((a, b) => b.count - a.count);

  const deptMap = new Map<string, CompanyPerson[]>();
  for (const p of peopleRows) {
    const d = inferDepartment(p.title);
    if (!deptMap.has(d)) deptMap.set(d, []);
    deptMap.get(d)!.push(p);
  }
  const ORDER = ['Leadership', 'Go-to-Market', 'Engineering', 'Product & Design', 'Marketing', 'Operations', 'Other'];
  const departments = ORDER.filter((d) => deptMap.has(d)).map((name) => ({ name, people: deptMap.get(name)! }));

  return { company, timeline, byType, people: peopleRows, departments };
}
