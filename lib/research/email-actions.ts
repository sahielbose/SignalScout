'use server';

import { auth } from '@/lib/auth';
import { requireOrgId } from '@/lib/auth/session';
import { getByoKey } from '@/lib/users/service';
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
  } catch (err) {
    // Let the NEXT_REDIRECT from requireOrgId propagate so the redirect happens.
    if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    return { ok: false, error: 'Not signed in.' };
  }

  try {
    const s = await auth();
    const byoKey = s?.user?.id ? await getByoKey(s.user.id) : null;
    return await draftOutreachEmail(orgId, id, byoKey);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
