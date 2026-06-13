import { and, arrayOverlaps, eq, exists, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { companies, dossiers, listMembers, lists, people, signals } from '@/lib/db/schema';
import { getOrgIcpIds } from '@/lib/feed/queries';

export type SearchKind = 'person' | 'company' | 'signal';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
}

export interface GlobalSearchResults {
  people: SearchResult[];
  companies: SearchResult[];
  signals: SearchResult[];
}

const GROUP_LIMIT = 6;

function emptyResults(): GlobalSearchResults {
  return { people: [], companies: [], signals: [] };
}

/**
 * Org-scoped, fail-closed global search across people, companies, and signals.
 * - People/companies match `normalizedName` via pg_trgm ILIKE, but only when the
 *   entity has a relationship to this org: referenced by an org dossier, an org
 *   list membership, or an org-matched signal (directly, or via the entity).
 * - Signals are org-scoped through the org's active ICPs (arrayOverlaps), matching
 *   title or rawContent.
 * Empty or whitespace `q` returns empty results.
 */
export async function globalSearch(orgId: string, q: string): Promise<GlobalSearchResults> {
  const term = q.trim();
  if (!term) return emptyResults();

  const orgIcpIds = await getOrgIcpIds(orgId);
  // No ICPs → no signals are org-matched, so no entity is reachable via a signal.
  // Dossier/list relationships are still org-scoped and may match below.
  const pattern = `%${term}%`;

  // A signal that belongs to this org via its matched ICPs.
  const orgSignalScope =
    orgIcpIds.length > 0 ? arrayOverlaps(signals.matchedIcpIds, orgIcpIds) : sql`false`;

  // ── People: trgm name match AND a relationship to this org ──────────────
  const personOrgRel = or(
    exists(
      db
        .select({ one: sql`1` })
        .from(dossiers)
        .where(and(eq(dossiers.personId, people.id), eq(dossiers.orgId, orgId))),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(listMembers)
        .innerJoin(lists, eq(lists.id, listMembers.listId))
        .where(and(eq(listMembers.personId, people.id), eq(lists.orgId, orgId))),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(signals)
        .where(
          and(
            orgSignalScope,
            or(
              eq(signals.personId, people.id),
              and(sql`${people.companyId} is not null`, eq(signals.companyId, people.companyId)),
            ),
          ),
        ),
    ),
  );

  const peopleRows = await db
    .select({
      id: people.id,
      fullName: people.fullName,
      title: people.title,
      companyName: companies.name,
    })
    .from(people)
    .leftJoin(companies, eq(companies.id, people.companyId))
    .where(and(ilike(people.normalizedName, pattern), personOrgRel))
    .limit(GROUP_LIMIT);

  // ── Companies: trgm name match AND a relationship to this org ───────────
  const companyOrgRel = or(
    exists(
      db
        .select({ one: sql`1` })
        .from(listMembers)
        .innerJoin(lists, eq(lists.id, listMembers.listId))
        .where(and(eq(listMembers.companyId, companies.id), eq(lists.orgId, orgId))),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(dossiers)
        .innerJoin(people, eq(people.id, dossiers.personId))
        .where(and(eq(people.companyId, companies.id), eq(dossiers.orgId, orgId))),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(signals)
        .where(and(orgSignalScope, eq(signals.companyId, companies.id))),
    ),
  );

  const companyRows = await db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
    })
    .from(companies)
    .where(and(ilike(companies.normalizedName, pattern), companyOrgRel))
    .limit(GROUP_LIMIT);

  // ── Signals: org-scoped via matched ICPs, title or rawContent match ─────
  let signalRows: { id: string; title: string | null; source: string }[] = [];
  if (orgIcpIds.length > 0) {
    signalRows = await db
      .select({
        id: signals.id,
        title: signals.title,
        source: signals.source,
      })
      .from(signals)
      .where(
        and(
          arrayOverlaps(signals.matchedIcpIds, orgIcpIds),
          or(ilike(signals.title, pattern), ilike(signals.rawContent, pattern)),
        ),
      )
      .limit(GROUP_LIMIT);
  }

  return {
    people: peopleRows.map((r) => ({
      kind: 'person' as const,
      id: r.id,
      label: r.fullName,
      sublabel: [r.title, r.companyName].filter(Boolean).join(' · ') || null,
      href: `/people/${r.id}`,
    })),
    companies: companyRows.map((r) => ({
      kind: 'company' as const,
      id: r.id,
      label: r.name ?? r.domain ?? 'Unknown company',
      sublabel: r.domain ?? null,
      href: `/companies/${r.id}`,
    })),
    signals: signalRows.map((r) => ({
      kind: 'signal' as const,
      id: r.id,
      label: r.title?.trim() || 'Untitled signal',
      sublabel: r.source,
      href: '/feed',
    })),
  };
}
