'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/auth/session';
import { hasEnrichment } from '@/lib/env';
import { getPersonWithDossier, type PersonWithContext } from '@/lib/research/people-queries';
import { enrichPerson, type EnrichResult } from './enrich';

/**
 * Enrich a single contact. Org-scoped via requireOrgId; degrades to a clean
 * disabled result when paid enrichment is off (no crash, no vendor call).
 */
export async function enrichPersonAction(personId: string): Promise<EnrichResult> {
  const orgId = await requireOrgId();
  const result = await enrichPerson(orgId, personId);
  revalidatePath(`/people/${personId}`);
  return result;
}

export interface PersonViewData {
  ctx: PersonWithContext | null;
  enrichmentEnabled: boolean;
}

/**
 * Org-scoped loader for the person page. Keeps all data access on the server even
 * though the page is a client island (so we get a live toast on enrich). Returns
 * null ctx when the person is not visible to this org (fail closed).
 */
export async function getPersonViewData(personId: string): Promise<PersonViewData> {
  const orgId = await requireOrgId();
  const ctx = await getPersonWithDossier(orgId, personId);
  return { ctx, enrichmentEnabled: hasEnrichment() };
}
