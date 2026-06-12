import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { llmRuns } from '@/lib/db/schema';

export async function getCostSeries(orgId: string, days = 14): Promise<{ day: string; cost: number; calls: number }[]> {
  const since = new Date(Date.now() - days * 86400_000);
  since.setHours(0, 0, 0, 0);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${llmRuns.createdAt}), 'YYYY-MM-DD')`,
      cost: sql<number>`coalesce(sum(${llmRuns.costUsd}),0)`,
      calls: sql<number>`count(*)::int`,
    })
    .from(llmRuns)
    .where(and(eq(llmRuns.orgId, orgId), gte(llmRuns.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${llmRuns.createdAt})`);

  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; cost: number; calls: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key);
    out.push({ day: key.slice(5), cost: Number((r?.cost ?? 0).toFixed(4)), calls: r?.calls ?? 0 });
  }
  return out;
}

export async function getCostByKind(orgId: string): Promise<{ kind: string; cost: number; calls: number }[]> {
  const rows = await db
    .select({
      kind: llmRuns.kind,
      cost: sql<number>`coalesce(sum(${llmRuns.costUsd}),0)`,
      calls: sql<number>`count(*)::int`,
    })
    .from(llmRuns)
    .where(eq(llmRuns.orgId, orgId))
    .groupBy(llmRuns.kind);
  return rows.map((r) => ({ kind: r.kind, cost: Number(r.cost.toFixed(4)), calls: r.calls }));
}
