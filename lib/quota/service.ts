import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { quotaUsage } from '@/lib/db/schema';
import { env } from '@/lib/env';

export type QuotaKind = 'classify' | 'research';

export class QuotaError extends Error {
  constructor(
    public kind: QuotaKind,
    public used: number,
    public limit: number,
  ) {
    super(`daily ${kind} quota exceeded (${used}/${limit})`);
    this.name = 'QuotaError';
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function quotaLimit(kind: QuotaKind): number {
  return kind === 'classify' ? env().DAILY_CLASSIFY_QUOTA : env().DAILY_RESEARCH_QUOTA;
}

/** Atomically increment today's counter and report whether it's within the limit. */
export async function consumeQuota(
  orgId: string,
  kind: QuotaKind,
  limitOverride?: number,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = limitOverride ?? quotaLimit(kind);
  const [row] = await db
    .insert(quotaUsage)
    .values({ orgId, day: today(), kind, count: 1 })
    .onConflictDoUpdate({
      target: [quotaUsage.orgId, quotaUsage.day, quotaUsage.kind],
      set: { count: sql`${quotaUsage.count} + 1` },
    })
    .returning({ count: quotaUsage.count });
  const used = row?.count ?? 1;
  return { allowed: used <= limit, used, limit };
}

/** Enforce: throws QuotaError when over. Skips when the actor brought their own key. */
export async function enforceQuota(orgId: string, kind: QuotaKind, opts?: { byoKey?: boolean }) {
  if (opts?.byoKey) return; // user pays their own way → no shared-tier limit
  const r = await consumeQuota(orgId, kind);
  if (!r.allowed) throw new QuotaError(kind, r.used, r.limit);
}

export async function getQuotaUsage(orgId: string): Promise<{
  classify: { used: number; limit: number };
  research: { used: number; limit: number };
}> {
  const rows = await db
    .select({ kind: quotaUsage.kind, count: quotaUsage.count })
    .from(quotaUsage)
    .where(and(eq(quotaUsage.orgId, orgId), eq(quotaUsage.day, today())));
  const map = Object.fromEntries(rows.map((r) => [r.kind, r.count]));
  return {
    classify: { used: map.classify ?? 0, limit: quotaLimit('classify') },
    research: { used: map.research ?? 0, limit: quotaLimit('research') },
  };
}
