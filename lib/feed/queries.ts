import { and, desc, eq, gte, sql, arrayOverlaps, arrayContains, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signals, companies, people, icps } from '@/lib/db/schema';
import type { SignalType, SourceName } from '@/lib/types';

export interface FeedFilters {
  icpId?: string;
  type?: SignalType;
  source?: SourceName;
  minStrength?: number;
  sinceDays?: number;
}

export interface FeedItem {
  id: string;
  source: string;
  type: string | null;
  strength: number | null;
  title: string | null;
  summary: string | null;
  sourceUrl: string | null;
  justification: string | null;
  publishedAt: Date | null;
  ingestedAt: Date;
  companyId: string | null;
  companyName: string | null;
  companyDomain: string | null;
  personId: string | null;
  personName: string | null;
  matchedIcpIds: string[];
}

export const FEED_PAGE_SIZE = 20;

export async function getOrgIcpIds(orgId: string, activeOnly = true): Promise<string[]> {
  const rows = await db
    .select({ id: icps.id })
    .from(icps)
    .where(activeOnly ? and(eq(icps.orgId, orgId), eq(icps.active, true)) : eq(icps.orgId, orgId));
  return rows.map((r) => r.id);
}

export async function getFeed(
  orgId: string,
  filters: FeedFilters = {},
  page = 0,
): Promise<{ items: FeedItem[]; hasMore: boolean; total: number }> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  // No ICPs yet → empty feed (nothing matched).
  if (orgIcpIds.length === 0) return { items: [], hasMore: false, total: 0 };

  const conds: SQL[] = [];
  // org scope: signals matched to one of the org's ICPs (or a specific ICP filter)
  if (filters.icpId && orgIcpIds.includes(filters.icpId)) {
    conds.push(arrayContains(signals.matchedIcpIds, [filters.icpId]));
  } else {
    conds.push(arrayOverlaps(signals.matchedIcpIds, orgIcpIds));
  }
  if (filters.type) conds.push(eq(signals.type, filters.type));
  if (filters.source) conds.push(eq(signals.source, filters.source));
  if (filters.minStrength != null) conds.push(gte(signals.strength, filters.minStrength));
  if (filters.sinceDays != null) {
    const since = new Date(Date.now() - filters.sinceDays * 86400_000).toISOString();
    conds.push(sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt}) >= ${since}::timestamptz`);
  }

  const where = and(...conds);
  const sortKey = sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt})`;

  const rows = await db
    .select({
      id: signals.id,
      source: signals.source,
      type: signals.type,
      strength: signals.strength,
      title: signals.title,
      summary: signals.rawContent,
      sourceUrl: signals.sourceUrl,
      justification: sql<string | null>`${signals.classification}->>'justification'`,
      publishedAt: signals.publishedAt,
      ingestedAt: signals.ingestedAt,
      companyId: signals.companyId,
      companyName: companies.name,
      companyDomain: companies.domain,
      personId: signals.personId,
      personName: people.fullName,
      matchedIcpIds: signals.matchedIcpIds,
    })
    .from(signals)
    .leftJoin(companies, eq(signals.companyId, companies.id))
    .leftJoin(people, eq(signals.personId, people.id))
    .where(where)
    .orderBy(desc(sortKey), desc(signals.id))
    .limit(FEED_PAGE_SIZE + 1)
    .offset(page * FEED_PAGE_SIZE);

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const items = rows.slice(0, FEED_PAGE_SIZE) as FeedItem[];

  const totalRow = (
    await db.select({ total: sql<number>`count(*)::int` }).from(signals).where(where)
  )[0];

  return { items, hasMore, total: totalRow?.total ?? 0 };
}

/** Distinct facets present in the org's matched feed (for the filter bar). */
export async function getFeedFacets(orgId: string): Promise<{ types: string[]; sources: string[] }> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  if (orgIcpIds.length === 0) return { types: [], sources: [] };
  const rows = await db
    .selectDistinct({ type: signals.type, source: signals.source })
    .from(signals)
    .where(arrayOverlaps(signals.matchedIcpIds, orgIcpIds));
  const types = [...new Set(rows.map((r) => r.type).filter((x): x is string => !!x))];
  const sources = [...new Set(rows.map((r) => r.source))];
  return { types, sources };
}
