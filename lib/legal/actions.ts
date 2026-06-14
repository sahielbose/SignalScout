'use server';

import { db } from '@/lib/db/client';
import { auditLogs } from '@/lib/db/schema';

export interface RemovalResult {
  ok: boolean;
  error?: string;
}

/**
 * Public data-removal request (GDPR/CCPA). This is an UNAUTHENTICATED endpoint,
 * so it never mutates tenant data: it only records the request for the operator
 * to verify and action within the statutory window. Writing to the shared,
 * globally-deduped people table from here would (a) cross every tenant boundary
 * by normalized name and (b) let an anonymous visitor clobber person metadata
 * at scale, so we deliberately do not. Operators wire verification + deletion
 * into their support flow off the back of this audit record.
 */
export async function requestDataRemovalAction(input: { email?: string; name?: string; note?: string }): Promise<RemovalResult> {
  const email = (input.email ?? '').trim().toLowerCase();
  const name = (input.name ?? '').trim();
  if (!email || !email.includes('@')) return { ok: false, error: 'A contact email is required so we can verify and confirm.' };

  await db.insert(auditLogs).values({
    orgId: null,
    actor: email,
    action: 'data_removal.requested',
    subjectType: 'person',
    detail: { email, name, note: (input.note ?? '').slice(0, 1000), receivedAt: new Date().toISOString() },
  });

  return { ok: true };
}
