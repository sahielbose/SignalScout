import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signalStatus } from '@/lib/db/schema';

export type SignalStatusValue = 'open' | 'snoozed' | 'actioned' | 'dismissed';

export const CLEARED_STATUSES: readonly SignalStatusValue[] = ['snoozed', 'actioned', 'dismissed'];

export interface SignalStatusRow {
  status: SignalStatusValue;
  snoozedUntil: Date | null;
}

/**
 * Upsert the worklist status for a signal within an org (PK = orgId+signalId).
 * `snoozedUntil` is only meaningful for the 'snoozed' status; it is cleared otherwise.
 */
export async function setSignalStatus(
  orgId: string,
  signalId: string,
  status: SignalStatusValue,
  snoozedUntil?: Date | null,
): Promise<void> {
  const until = status === 'snoozed' ? (snoozedUntil ?? null) : null;
  await db
    .insert(signalStatus)
    .values({ orgId, signalId, status, snoozedUntil: until, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [signalStatus.orgId, signalStatus.signalId],
      set: { status, snoozedUntil: until, updatedAt: new Date() },
    });
}

/** Reset a signal back to 'open' by deleting its worklist row (org-scoped). */
export async function clearSignalStatus(orgId: string, signalId: string): Promise<void> {
  await db
    .delete(signalStatus)
    .where(and(eq(signalStatus.orgId, orgId), eq(signalStatus.signalId, signalId)));
}

/** Read statuses for a set of signal ids within an org, keyed by signalId. */
export async function getSignalStatuses(
  orgId: string,
  signalIds: string[],
): Promise<Map<string, SignalStatusRow>> {
  const map = new Map<string, SignalStatusRow>();
  if (signalIds.length === 0) return map;
  const rows = await db
    .select({
      signalId: signalStatus.signalId,
      status: signalStatus.status,
      snoozedUntil: signalStatus.snoozedUntil,
    })
    .from(signalStatus)
    .where(and(eq(signalStatus.orgId, orgId), inArray(signalStatus.signalId, signalIds)));
  for (const r of rows) {
    map.set(r.signalId, {
      status: r.status as SignalStatusValue,
      snoozedUntil: r.snoozedUntil,
    });
  }
  return map;
}
