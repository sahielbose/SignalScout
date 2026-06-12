'use server';

import { isNotNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { signals } from '@/lib/db/schema';
import { createIcp, listIcps } from '@/lib/icp/service';
import { backfillIcpMatches } from '@/lib/icp/backfill';
import { runSources } from '@/lib/pipeline/ingest';
import { classifyPendingSignals } from '@/lib/pipeline/classify';
import { SAMPLE_ICP, QUICK_TARGETS } from '@/lib/sources/targets';

export interface OnboardResult {
  ok: boolean;
  icp?: string;
  ingested?: number;
  error?: string;
}

/** One-click: ensure a populated feed for a brand-new org. */
export async function seedSampleAction(): Promise<OnboardResult> {
  try {
    const orgId = await requireOrgId();

    // 1) make sure the shared signal pool has something to match against
    const [poolRow] = await db.select({ count: sql<number>`count(*)::int` }).from(signals).where(isNotNull(signals.type));
    let ingested = 0;
    if ((poolRow?.count ?? 0) < 20) {
      const res = await runSources(QUICK_TARGETS, { limit: 8 });
      ingested = res.reduce((n, r) => n + r.inserted, 0);
      await classifyPendingSignals({ orgId, limit: 200 });
    }

    // 2) ensure a starter ICP (createIcp backfills matches from the pool)
    const existing = await listIcps(orgId);
    let icpName = existing[0]?.name;
    if (existing.length === 0) {
      const icp = await createIcp(orgId, SAMPLE_ICP.name, SAMPLE_ICP.definition);
      icpName = icp?.name;
    } else {
      // re-match the pool in case new signals were just ingested
      for (const i of existing) await backfillIcpMatches({ id: i.id, definition: i.definition });
    }

    revalidatePath('/feed');
    return { ok: true, icp: icpName, ingested };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
