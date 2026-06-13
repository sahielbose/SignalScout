'use server';

import { requireOrgId } from '@/lib/auth/session';
import { draftOutreachEmail, type EmailDraftResult } from './email-draft';

/**
 * Draft a personalized cold outreach email for a person from their cited dossier.
 * Org-scoped via requireOrgId; fail-closed inside draftOutreachEmail when the org
 * has no dossier for this person.
 */
export async function draftEmailAction(personId: string): Promise<EmailDraftResult> {
  const id = personId?.trim();
  if (!id) return { ok: false, error: 'Missing person.' };

  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch {
    return { ok: false, error: 'Not signed in.' };
  }

  try {
    return await draftOutreachEmail(orgId, id);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
