import { and, asc, desc, eq, gte, lte, or, sql, arrayOverlaps, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signals, companies, people } from '@/lib/db/schema';
import { getOrgIcpIds } from '@/lib/feed/queries';

export interface EventItem {
  id: string;
  source: string;
  type: string | null;
  strength: number | null;
  /** Event name / title (falls back to a generic label when missing). */
  title: string | null;
  summary: string | null;
  sourceUrl: string | null;
  justification: string | null;
  /** When the event was published / scheduled. */
  date: Date | null;
  ingestedAt: Date;
  companyId: string | null;
  companyName: string | null;
  companyDomain: string | null;
  /** A person linked to this event signal - a prioritized, ICP-matched attendee. */
  personId: string | null;
  personName: string | null;
  personTitle: string | null;
  matchedIcpIds: string[];
}

/** How the events list is ordered. Defaults to soonest-first. */
export type EventSort = 'soonest' | 'recent' | 'strongest';

/** Forward-looking date windows (in days). `null` means no date limit. */
export type EventWithinDays = 7 | 30 | 90 | null;

export interface EventsOptions {
  /** Only events whose date falls within the next N days. `null`/undefined = all. */
  withinDays?: EventWithinDays;
  /** Limit to one signal type (taxonomy value, e.g. 'event'). */
  type?: string;
  /** Minimum buying-sign strength, 0..1. */
  minStrength?: number;
  /** Ordering of the returned list. */
  sort?: EventSort;
}

/** Hard cap on rows returned, regardless of filters. */
const EVENTS_LIMIT = 100;

/**
 * Org's event-type signals for the Conference Prep view.
 *
 * Returns signals where type='event' OR source='luma', org-scoped to the org's
 * ICPs (via getOrgIcpIds + arrayOverlaps on matchedIcpIds). Fails closed: an org
 * with no ICPs sees nothing.
 *
 * Options narrow + order the list:
 *  - withinDays: keep only events dated within the next N days (forward window).
 *  - type:       restrict to a single taxonomy type.
 *  - minStrength: keep only events at/above a strength floor (0..1).
 *  - sort:       'soonest' (date ascending, default), 'recent' (date descending),
 *                or 'strongest' (strength descending).
 */
export async function getEvents(orgId: string, options: EventsOptions = {}): Promise<EventItem[]> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  // No ICPs → nothing matched → empty (no cross-tenant leakage).
  if (orgIcpIds.length === 0) return [];

  // The date we sort/filter on: scheduled date when known, else when we saw it.
  const eventDate = sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt})`;

  const conds: SQL[] = [
    arrayOverlaps(signals.matchedIcpIds, orgIcpIds),
    or(eq(signals.type, 'event'), eq(signals.source, 'luma'))!,
  ];

  if (options.type) conds.push(eq(signals.type, options.type));

  if (options.minStrength != null && options.minStrength > 0) {
    conds.push(gte(signals.strength, options.minStrength));
  }

  // Forward-looking window: from now to now + N days, on the event date.
  if (options.withinDays != null) {
    const nowIso = new Date().toISOString();
    const untilIso = new Date(Date.now() + options.withinDays * 86400_000).toISOString();
    conds.push(gte(eventDate, sql`${nowIso}::timestamptz`));
    conds.push(lte(eventDate, sql`${untilIso}::timestamptz`));
  }

  const where = and(...conds);

  const orderBy =
    options.sort === 'recent'
      ? [desc(eventDate), desc(signals.strength), desc(signals.id)]
      : options.sort === 'strongest'
        ? [desc(signals.strength), asc(eventDate), desc(signals.id)]
        : // 'soonest' (default): nearest upcoming first, then strongest.
          [asc(eventDate), desc(signals.strength), desc(signals.id)];

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
      date: signals.publishedAt,
      ingestedAt: signals.ingestedAt,
      companyId: signals.companyId,
      companyName: companies.name,
      companyDomain: companies.domain,
      personId: signals.personId,
      personName: people.fullName,
      personTitle: people.title,
      matchedIcpIds: signals.matchedIcpIds,
    })
    .from(signals)
    .leftJoin(companies, eq(signals.companyId, companies.id))
    .leftJoin(people, eq(signals.personId, people.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(EVENTS_LIMIT);

  return rows as EventItem[];
}

/**
 * Distinct signal types present in the org's matched events, for the filter
 * dropdown. Org-scoped; fails closed (no ICPs → no types).
 */
export async function getEventTypes(orgId: string): Promise<string[]> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  if (orgIcpIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ type: signals.type })
    .from(signals)
    .where(
      and(
        arrayOverlaps(signals.matchedIcpIds, orgIcpIds),
        or(eq(signals.type, 'event'), eq(signals.source, 'luma')),
      ),
    );
  return rows.map((r) => r.type).filter((t): t is string => !!t);
}
