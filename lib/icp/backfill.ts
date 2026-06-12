import { desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signals } from '@/lib/db/schema';
import { signalMatchesIcp } from '@/lib/classify/match';
import type { IcpDefinition, SignalType } from '@/lib/types';

/**
 * Append an ICP id to matched_icp_ids on already-classified signals it matches.
 * This is what makes a freshly-created ICP immediately populate the feed from the
 * shared, global signal pool (signals are classified once, matched many).
 */
export async function backfillIcpMatches(
  icp: { id: string; definition: IcpDefinition },
  limit = 2000,
): Promise<number> {
  const rows = await db
    .select({ id: signals.id, type: signals.type, title: signals.title, rawContent: signals.rawContent, matchedIcpIds: signals.matchedIcpIds })
    .from(signals)
    .where(isNotNull(signals.type))
    .orderBy(desc(signals.ingestedAt))
    .limit(limit);

  const toMatch: string[] = [];
  for (const s of rows) {
    if (s.matchedIcpIds.includes(icp.id)) continue;
    const text = [s.title, s.rawContent].filter(Boolean).join('\n');
    if (s.type && signalMatchesIcp(text, s.type as SignalType, icp.definition)) toMatch.push(s.id);
  }
  if (toMatch.length === 0) return 0;
  await db
    .update(signals)
    .set({ matchedIcpIds: sql`array_append(${signals.matchedIcpIds}, ${icp.id}::uuid)` })
    .where(inArray(signals.id, toMatch));
  return toMatch.length;
}

/** Drop an ICP id from all signals (on ICP edit/delete) before re-matching. */
export async function removeIcpMatches(icpId: string): Promise<void> {
  await db
    .update(signals)
    .set({ matchedIcpIds: sql`array_remove(${signals.matchedIcpIds}, ${icpId}::uuid)` })
    .where(sql`${icpId}::uuid = any(${signals.matchedIcpIds})`);
}
