'use server';

import { db } from '@/lib/db/client';
import { auditLogs, people } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeName } from '@/lib/entity/normalize';

export interface RemovalResult {
  ok: boolean;
  error?: string;
}

/**
 * Public data-removal request (GDPR/CCPA). Records the request for the operator
 * to action within the statutory window, and flags any matching person rows.
 * Operators should wire verification + actual deletion into their support flow.
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

  // best-effort: flag matching person rows for the operator's review (not auto-deleted)
  if (name) {
    const normalized = normalizeName(name);
    await db.update(people).set({ metadata: { removalRequested: true } }).where(eq(people.normalizedName, normalized));
  }

  return { ok: true };
}
