import {
  and,
  asc,
  desc,
  eq,
  gte,
  sql,
  or,
  ilike,
  inArray,
  isNull,
  arrayOverlaps,
  arrayContains,
  type SQL,
} from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signals, companies, people, icps, signalStatus } from '@/lib/db/schema';
import type { SignalStatusValue } from '@/lib/feed/status';
import { SignalTypeSchema, SourceSchema, type SignalType, type SourceName } from '@/lib/types';

/** Ways the feed can be ordered. Plain-language labels live in the filter bar. */
export const FEED_SORTS = ['newest', 'strongest', 'oldest'] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export interface FeedFilters {
  icpId?: string;
  /** Single signal type (kept for back-compat with the public API). */
  type?: SignalType;
  /** Single source (kept for back-compat with the public API). */
  source?: SourceName;
  /** Pick several signal types at once (a signal is a public buying moment). */
  types?: SignalType[];
  /** Pick several sources at once. */
  sources?: SourceName[];
  /** Free-text match on company name, title, or content. */
  search?: string;
  /** How to order the list. Defaults to newest first. */
  sort?: FeedSort;
  minStrength?: number;
  sinceDays?: number;
  /** When true, do NOT hide dismissed/actioned/active-snoozed signals. */
  showCleared?: boolean;
}

/**
 * Parse the feed's URL params into a typed filter object. Shared by the server
 * page and the load-more path so the two never drift. Multi-select type/source
 * arrive as comma-separated lists (e.g. `type=funding,hiring`).
 */
export function parseFeedFilters(sp: URLSearchParams): FeedFilters {
  const filters: FeedFilters = {};

  const icpId = sp.get('icpId');
  if (icpId && /^[0-9a-f-]{36}$/i.test(icpId)) filters.icpId = icpId;

  const types = (sp.get('type') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t): t is SignalType => SignalTypeSchema.safeParse(t).success);
  if (types.length === 1) filters.type = types[0];
  else if (types.length > 1) filters.types = [...new Set(types)];

  const sources = (sp.get('source') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s): s is SourceName => SourceSchema.safeParse(s).success);
  if (sources.length === 1) filters.source = sources[0];
  else if (sources.length > 1) filters.sources = [...new Set(sources)];

  const search = (sp.get('q') ?? '').trim();
  if (search) filters.search = search.slice(0, 120);

  const sort = sp.get('sort');
  if (sort && (FEED_SORTS as readonly string[]).includes(sort)) filters.sort = sort as FeedSort;

  const minStrength = Number(sp.get('minStrength'));
  if (Number.isFinite(minStrength) && minStrength > 0) filters.minStrength = minStrength;

  const sinceDays = Number(sp.get('sinceDays'));
  if (Number.isFinite(sinceDays) && sinceDays > 0) filters.sinceDays = sinceDays;

  if (sp.get('showCleared') === '1') filters.showCleared = true;

  return filters;
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
  /** Worklist state for the current org. 'open' when no row exists. */
  status: SignalStatusValue;
  snoozedUntil: Date | null;
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
  // Signal type: a single value OR a multi-select list (pick several at once).
  if (filters.types && filters.types.length > 0) {
    conds.push(inArray(signals.type, filters.types));
  } else if (filters.type) {
    conds.push(eq(signals.type, filters.type));
  }
  // Source: a single value OR a multi-select list.
  if (filters.sources && filters.sources.length > 0) {
    conds.push(inArray(signals.source, filters.sources));
  } else if (filters.source) {
    conds.push(eq(signals.source, filters.source));
  }
  // Free-text search across company name, title, and the signal's content.
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(
      or(
        ilike(companies.name, pattern),
        ilike(signals.title, pattern),
        ilike(signals.rawContent, pattern),
      )!,
    );
  }
  if (filters.minStrength != null) conds.push(gte(signals.strength, filters.minStrength));
  if (filters.sinceDays != null) {
    const since = new Date(Date.now() - filters.sinceDays * 86400_000).toISOString();
    conds.push(sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt}) >= ${since}::timestamptz`);
  }

  // Worklist exclusion (default): hide dismissed/actioned signals and snoozed
  // ones whose snooze is still in the future. 'open' (no row) always shows.
  if (!filters.showCleared) {
    const nowIso = new Date().toISOString();
    conds.push(
      or(
        isNull(signalStatus.status),
        eq(signalStatus.status, 'open'),
        and(eq(signalStatus.status, 'snoozed'), sql`${signalStatus.snoozedUntil} is null`),
        and(
          eq(signalStatus.status, 'snoozed'),
          sql`${signalStatus.snoozedUntil} <= ${nowIso}::timestamptz`,
        ),
      )!,
    );
  }

  // org-scoped LEFT JOIN onto the worklist (keeps signals with no status row).
  const statusJoinOn = and(
    eq(signalStatus.signalId, signals.id),
    eq(signalStatus.orgId, orgId),
  );

  const where = and(...conds);
  const dateKey = sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt})`;
  // Strongest first puts the most convincing buying signs at the top, then
  // breaks ties by recency. Oldest/newest sort purely by date.
  const orderBy: SQL[] =
    filters.sort === 'strongest'
      ? [desc(sql`coalesce(${signals.strength}, 0)`), desc(dateKey), desc(signals.id)]
      : filters.sort === 'oldest'
        ? [asc(dateKey), asc(signals.id)]
        : [desc(dateKey), desc(signals.id)];

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
      status: signalStatus.status,
      snoozedUntil: signalStatus.snoozedUntil,
    })
    .from(signals)
    .leftJoin(companies, eq(signals.companyId, companies.id))
    .leftJoin(people, eq(signals.personId, people.id))
    .leftJoin(signalStatus, statusJoinOn)
    .where(where)
    .orderBy(...orderBy)
    .limit(FEED_PAGE_SIZE + 1)
    .offset(page * FEED_PAGE_SIZE);

  const hasMore = rows.length > FEED_PAGE_SIZE;
  const items: FeedItem[] = rows.slice(0, FEED_PAGE_SIZE).map((r) => ({
    ...r,
    status: (r.status as SignalStatusValue | null) ?? 'open',
    snoozedUntil: r.snoozedUntil ?? null,
  }));

  // Only the first page needs the total; the client ignores it afterward, so
  // skip the extra count(*) on every infinite-scroll fetch.
  // The count must join `companies` too, because a free-text search filters on
  // the company name. Without this join the WHERE would reference a table that
  // is not in the FROM clause and the query would fail.
  const totalRow =
    page === 0
      ? (
          await db
            .select({ total: sql<number>`count(*)::int` })
            .from(signals)
            .leftJoin(companies, eq(signals.companyId, companies.id))
            .leftJoin(signalStatus, statusJoinOn)
            .where(where)
        )[0]
      : undefined;

  return { items, hasMore, total: totalRow?.total ?? items.length };
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
