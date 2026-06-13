'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/auth/session';
import { pushListToCrm, type CrmPushSummary } from './push';

/**
 * Gated, audited CRM push for a saved list. Always org-scoped via requireOrgId.
 * The UI confirms before calling this; pushListToCrm itself never throws.
 */
export async function pushListToCrmAction(listId: string): Promise<CrmPushSummary> {
  const orgId = await requireOrgId();
  const summary = await pushListToCrm(orgId, listId);
  revalidatePath(`/lists/${listId}`);
  return summary;
}
