import { and, eq, exists, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { people, companies, dossiers, signals, lists, listMembers, auditLogs } from '@/lib/db/schema';
import { hasEnrichment } from '@/lib/env';
import { getEnrichmentProvider, type EnrichmentInput } from '@/lib/providers/enrichment';

/**
 * Optional paid contact enrichment. Off by default (ENABLE_PAID_ENRICHMENT=false
 * or no vendor key) and in that state we degrade cleanly to a no-op disabled result
 * and never touch a paid vendor.
 *
 * Org-scoping: the people table has no org column, so a person is "visible" to an
 * org only when that org has a relationship to them via an org-scoped table
 * (a dossier, a matched signal, or a list membership). We fail closed: if the org
 * has no such link, enrichment refuses to load or mutate the row.
 */

export type EnrichResult =
  | { enriched: false; reason: string }
  | { enriched: true; fields: string[] };

const DISABLED_REASON =
  'Paid enrichment is off. Set ENABLE_PAID_ENRICHMENT and a vendor key.';

/** A person is reachable by this org if any org-scoped table links to them. */
function orgOwnsPerson(orgId: string, personId: string) {
  return or(
    exists(
      db
        .select({ one: dossiers.id })
        .from(dossiers)
        .where(and(eq(dossiers.personId, personId), eq(dossiers.orgId, orgId))),
    ),
    exists(
      db
        .select({ one: signals.id })
        .from(signals)
        .where(and(eq(signals.personId, personId), eq(signals.orgId, orgId))),
    ),
    exists(
      db
        .select({ one: listMembers.id })
        .from(listMembers)
        .innerJoin(lists, eq(listMembers.listId, lists.id))
        .where(and(eq(listMembers.personId, personId), eq(lists.orgId, orgId))),
    ),
  );
}

export async function enrichPerson(orgId: string, personId: string): Promise<EnrichResult> {
  // Tenant-safe load: only return the person if this org actually owns them.
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), orgOwnsPerson(orgId, personId)))
    .limit(1);

  if (!person) {
    return { enriched: false, reason: 'Person not found for this organization.' };
  }

  // Off-by-default: clean disabled state, never call a paid vendor.
  if (!hasEnrichment()) {
    return { enriched: false, reason: DISABLED_REASON };
  }

  let company: string | undefined;
  if (person.companyId) {
    const [c] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, person.companyId))
      .limit(1);
    company = c?.name ?? undefined;
  }

  const input: EnrichmentInput = {
    fullName: person.fullName,
    company,
    linkedinUrl: person.linkedinUrl ?? undefined,
    githubLogin: person.githubLogin ?? undefined,
    email: person.email ?? undefined,
  };

  let result;
  try {
    result = await getEnrichmentProvider().enrich(input);
  } catch {
    return { enriched: false, reason: 'Enrichment provider call failed.' };
  }
  if (!result) {
    return { enriched: false, reason: 'No additional contact details found.' };
  }

  // Build a patch. NEVER overwrite a non-null strong field with null/empty.
  const patch: Partial<typeof people.$inferInsert> = {};
  const fields: string[] = [];

  // Strong keys (email, linkedinUrl) are only filled when currently absent;
  // soft fields (title, location) may be refreshed. Never write null/empty.
  const STRONG = new Set(['email', 'linkedinUrl']);
  const maybeSet = (key: 'email' | 'title' | 'location' | 'linkedinUrl', value?: string | null) => {
    const next = typeof value === 'string' ? value.trim() : '';
    if (!next) return; // never clobber with null/empty
    if (person[key] === next) return; // no change
    if (STRONG.has(key) && person[key]) return; // never overwrite a present strong field
    (patch as Record<string, unknown>)[key] = next;
    fields.push(key);
  };

  maybeSet('email', result.email);
  maybeSet('title', result.title);
  maybeSet('location', result.location);
  maybeSet('linkedinUrl', result.linkedinUrl);

  const mergedMetadata = {
    ...(person.metadata ?? {}),
    enrichedAt: new Date().toISOString(),
    enrichmentSource: result.source,
    ...(result.seniority ? { seniority: result.seniority } : {}),
  };

  await db
    .update(people)
    .set({ ...patch, metadata: mergedMetadata, updatedAt: new Date() })
    .where(eq(people.id, personId));

  await db.insert(auditLogs).values({
    orgId,
    action: 'person.enrich',
    subjectType: 'person',
    subjectId: personId,
    detail: { source: result.source, fields },
  });

  return { enriched: true, fields };
}
