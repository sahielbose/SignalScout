import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { llmRuns } from '@/lib/db/schema';

/** How many days of AI-spend history the Metrics page can show at once. */
export const COST_RANGES = [7, 14, 30, 90] as const;
export type CostRange = (typeof COST_RANGES)[number];

/** Start of the window: midnight, `days` days ago (inclusive of today). */
function windowStart(days: number): Date {
  const since = new Date(Date.now() - days * 86400_000);
  since.setHours(0, 0, 0, 0);
  return since;
}

export async function getCostSeries(orgId: string, days = 14): Promise<{ day: string; cost: number; calls: number }[]> {
  const since = windowStart(days);
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

/**
 * Spend grouped by the kind of model call (for example "classify" labels a
 * signal, "dossier" builds a research profile). When `days` is given, only
 * count calls inside that window; otherwise count all time. Always org-scoped.
 */
export async function getCostByKind(orgId: string, days?: number): Promise<{ kind: string; cost: number; calls: number }[]> {
  const where =
    days != null
      ? and(eq(llmRuns.orgId, orgId), gte(llmRuns.createdAt, windowStart(days)))
      : eq(llmRuns.orgId, orgId);
  const rows = await db
    .select({
      kind: llmRuns.kind,
      cost: sql<number>`coalesce(sum(${llmRuns.costUsd}),0)`,
      calls: sql<number>`count(*)::int`,
    })
    .from(llmRuns)
    .where(where)
    .groupBy(llmRuns.kind)
    .orderBy(sql`coalesce(sum(${llmRuns.costUsd}),0) desc`);
  return rows.map((r) => ({ kind: r.kind, cost: Number(r.cost.toFixed(4)), calls: r.calls }));
}

/**
 * One row per day, with a column per kind of model call, so the chart can show
 * spend stacked by kind across the chosen window. The shape is
 * `{ day, total, [kind]: cost }`; `kinds` lists the kinds present, biggest
 * spender first, so the caller can render a stacked area per kind. Org-scoped.
 */
export async function getCostByKindSeries(
  orgId: string,
  days = 14,
): Promise<{ rows: Array<{ day: string; total: number } & Record<string, number>>; kinds: string[] }> {
  const since = windowStart(days);
  const grouped = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${llmRuns.createdAt}), 'YYYY-MM-DD')`,
      kind: llmRuns.kind,
      cost: sql<number>`coalesce(sum(${llmRuns.costUsd}),0)`,
    })
    .from(llmRuns)
    .where(and(eq(llmRuns.orgId, orgId), gte(llmRuns.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${llmRuns.createdAt})`, llmRuns.kind);

  // Rank kinds by total spend so the legend and stack order are stable.
  const kindTotals = new Map<string, number>();
  // dayKey (YYYY-MM-DD) -> kind -> cost
  const byDay = new Map<string, Map<string, number>>();
  for (const r of grouped) {
    kindTotals.set(r.kind, (kindTotals.get(r.kind) ?? 0) + Number(r.cost));
    let m = byDay.get(r.day);
    if (!m) {
      m = new Map();
      byDay.set(r.day, m);
    }
    m.set(r.kind, Number(r.cost));
  }
  const kinds = [...kindTotals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const rows: Array<{ day: string; total: number } & Record<string, number>> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    const m = byDay.get(key);
    const row = { day: key.slice(5), total: 0 } as { day: string; total: number } & Record<string, number>;
    let total = 0;
    for (const k of kinds) {
      const c = Number((m?.get(k) ?? 0).toFixed(4));
      row[k] = c;
      total += c;
    }
    row.total = Number(total.toFixed(4));
    rows.push(row);
  }
  return { rows, kinds };
}
