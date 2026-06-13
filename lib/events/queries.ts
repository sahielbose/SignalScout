import { and, desc, eq, or, sql, arrayOverlaps } from 'drizzle-orm';
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

/**
 * Org's event-type signals for the Conference Prep view.
 *
 * Returns signals where type='event' OR source='luma', org-scoped to the org's
 * ICPs (via getOrgIcpIds + arrayOverlaps on matchedIcpIds). Fails closed: an org
 * with no ICPs sees nothing. Sorted by recency, then strength.
 */
export async function getEvents(orgId: string): Promise<EventItem[]> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  // No ICPs → nothing matched → empty (no cross-tenant leakage).
  if (orgIcpIds.length === 0) return [];

  const where = and(
    arrayOverlaps(signals.matchedIcpIds, orgIcpIds),
    or(eq(signals.type, 'event'), eq(signals.source, 'luma')),
  );

  const recency = sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt})`;

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
    .orderBy(desc(recency), desc(signals.strength), desc(signals.id))
    .limit(100);

  return rows as EventItem[];
}
