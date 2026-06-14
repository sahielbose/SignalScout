/**
 * Seed: ensure an org + a sample ICP, ingest from real public sources, classify,
 * and report ICP-matched signals. Idempotent + runnable repeatedly.
 *   pnpm seed                 # full ingest + classify
 *   pnpm seed --classify-only # re-run classification over existing signals
 */
import 'dotenv/config';
import { eq, desc, sql } from 'drizzle-orm';
import { db, pgClient } from '@/lib/db/client';
import { organizations, users, icps, signals, companies } from '@/lib/db/schema';
import { createIcp, listIcps } from '@/lib/icp/service';
import { runSources } from '@/lib/pipeline/ingest';
import { classifyPendingSignals } from '@/lib/pipeline/classify';
import { DEFAULT_TARGETS } from '@/lib/sources/targets';
import { SIGNAL_TYPE_LABELS, type IcpDefinition } from '@/lib/types';
import { hasLLM } from '@/lib/env';

const SAMPLE_ICP: { name: string; definition: IcpDefinition } = {
  name: 'Fintech & developer-tools companies - funding, GTM expansion, launches',
  definition: {
    industries: ['fintech', 'developer tools', 'payments', 'saas', 'infrastructure', 'ai'],
    titles: ['account executive', 'head of sales', 'gtm', 'revenue', 'sales lead', 'growth'],
    companySize: '11-500',
    keywords: ['payments', 'api', 'developer', 'platform', 'infrastructure', 'fintech', 'data', 'sales', 'revenue', 'sdk'],
    geos: ['United States', 'Remote'],
    signalTypes: ['funding', 'expansion', 'product_launch', 'github_release', 'partnership', 'buying_intent'],
    notify: { email: true, slack: false },
    notifyThreshold: 0.6,
  },
};

async function ensureOrg(): Promise<string> {
  const [existing] = await db.select().from(organizations).orderBy(desc(organizations.createdAt)).limit(1);
  if (existing) return existing.id;
  const [org] = await db.insert(organizations).values({ name: 'Signal Scout Demo' }).returning();
  await db
    .insert(users)
    .values({ email: 'demo@signalscout.dev', name: 'Demo User', orgId: org!.id, role: 'owner', emailVerified: new Date() })
    .onConflictDoNothing();
  return org!.id;
}

async function ensureIcp(orgId: string): Promise<void> {
  const existing = await listIcps(orgId);
  if (existing.length > 0) {
    console.log(`  ICP already present: "${existing[0]!.name}"`);
    return;
  }
  const icp = await createIcp(orgId, SAMPLE_ICP.name, SAMPLE_ICP.definition);
  console.log(`  created ICP: "${icp!.name}"`);
}

async function main() {
  const classifyOnly = process.argv.includes('--classify-only');
  console.log(`\n▶ seeding Signal Scout (LLM: ${hasLLM() ? 'real' : 'mock'})\n`);

  const orgId = await ensureOrg();
  console.log(`org: ${orgId}`);
  await ensureIcp(orgId);

  if (!classifyOnly) {
    console.log(`\n▶ ingesting ${DEFAULT_TARGETS.length} sources…`);
    const results = await runSources(DEFAULT_TARGETS, { limit: 10 });
    let inserted = 0;
    for (const r of results) {
      const tag = r.error ? `ERROR ${r.error}` : `+${r.inserted} new / ${r.skipped} dup (${r.fetched} fetched)`;
      console.log(`  ${r.source}/${r.key}: ${tag}`);
      inserted += r.inserted;
    }
    console.log(`  → ${inserted} new signals ingested`);
  }

  console.log(`\n▶ classifying pending signals…`);
  // Drain the queue in batches so a large ingest (many sources) is fully
  // classified, not capped at a single batch.
  let totalClassified = 0;
  let totalMatched = 0;
  for (let round = 0; round < 30; round++) {
    const c = await classifyPendingSignals({ limit: 100, orgId });
    totalClassified += c.classified;
    totalMatched += c.matched;
    if (c.classified === 0) break;
    console.log(`  round ${round + 1}: classified ${c.classified}, ${c.matched} matched`);
  }
  console.log(`  classified ${totalClassified}, ${totalMatched} matched an ICP`);

  // report matched signals
  const matched = await db
    .select({
      type: signals.type,
      strength: signals.strength,
      title: signals.title,
      source: signals.source,
      company: companies.name,
      justification: sql<string>`${signals.classification}->>'justification'`,
    })
    .from(signals)
    .leftJoin(companies, eq(signals.companyId, companies.id))
    .where(sql`array_length(${signals.matchedIcpIds}, 1) > 0`)
    .orderBy(desc(signals.strength))
    .limit(15);

  console.log(`\n▶ top ICP-matched signals (${matched.length}):\n`);
  for (const m of matched) {
    const label = m.type ? (SIGNAL_TYPE_LABELS[m.type as keyof typeof SIGNAL_TYPE_LABELS] ?? m.type) : '?';
    console.log(`  [${(m.strength ?? 0).toFixed(2)}] ${label.padEnd(16)} ${m.company ?? '-'} · ${m.source}`);
    console.log(`         ${(m.title ?? '').slice(0, 90)}`);
  }

  const totalRow = (await db.select({ total: sql<number>`count(*)::int` }).from(signals))[0];
  console.log(`\n✓ done - ${totalRow?.total ?? 0} total signals in DB\n`);
  await pgClient.end({ timeout: 5 });
  process.exit(0);
}

main().catch(async (err) => {
  console.error('seed failed:', err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
