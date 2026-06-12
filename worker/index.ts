/**
 * Signal Scout worker — a SEPARATE process from the web app (pg-boss needs a
 * long-running host). Schedules ingestion → classification → notifications, and a
 * daily email digest.
 *   pnpm worker
 */
import 'dotenv/config';
import PgBoss from 'pg-boss';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { icps, users } from '@/lib/db/schema';
import { runSources } from '@/lib/pipeline/ingest';
import { classifyPendingSignals } from '@/lib/pipeline/classify';
import { dispatchSignalNotifications } from '@/lib/delivery/dispatch';
import { getFeed } from '@/lib/feed/queries';
import { renderDigest, sendEmail, type DigestSignal } from '@/lib/delivery/email';
import { DEFAULT_TARGETS } from '@/lib/sources/targets';
import { env } from '@/lib/env';

function log(msg: string) {
  console.log(`[worker ${new Date().toISOString()}] ${msg}`);
}

async function activeOrgIds(): Promise<string[]> {
  const rows = await db.selectDistinct({ orgId: icps.orgId }).from(icps).where(eq(icps.active, true));
  return rows.map((r) => r.orgId).filter((x): x is string => !!x);
}

async function ingestJob() {
  log(`ingesting ${DEFAULT_TARGETS.length} sources…`);
  const results = await runSources(DEFAULT_TARGETS, { limit: 15 });
  const inserted = results.reduce((n, r) => n + r.inserted, 0);
  log(`ingested ${inserted} new signals`);

  for (const orgId of await activeOrgIds()) {
    const c = await classifyPendingSignals({ orgId, limit: 300 });
    const d = await dispatchSignalNotifications(orgId);
    log(`org ${orgId.slice(0, 8)}: classified ${c.classified} (${c.matched} matched), notified ${d.notified} (webhooks ${d.webhooks}, slack ${d.slack})`);
  }
}

async function digestJob() {
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  for (const orgId of await activeOrgIds()) {
    const [owner] = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.role, 'owner')))
      .orderBy(desc(users.createdAt))
      .limit(1);
    if (!owner?.email) continue;
    const { items } = await getFeed(orgId, { sinceDays: 1, minStrength: 0.6 }, 0);
    const signals: DigestSignal[] = items.map((s) => ({ type: s.type, strength: s.strength, company: s.companyName, title: s.title, summary: s.summary, url: s.sourceUrl, source: s.source }));
    const { subject, html, text } = renderDigest('your workspace', signals, appUrl);
    const r = await sendEmail({ to: owner.email, subject, html, text });
    log(`digest → ${owner.email} (${signals.length} signals, via ${r.via})`);
  }
}

async function main() {
  const boss = new PgBoss({ connectionString: env().DATABASE_URL, schema: 'pgboss' });
  boss.on('error', (e) => console.error('[pg-boss]', e));
  await boss.start();

  await boss.createQueue('ingest');
  await boss.createQueue('digest');

  await boss.work('ingest', async () => {
    await ingestJob();
  });
  await boss.work('digest', async () => {
    await digestJob();
  });

  // schedules (cron, UTC)
  await boss.schedule('ingest', '*/30 * * * *');
  await boss.schedule('digest', '0 13 * * *');

  // run an ingest once on startup
  await boss.send('ingest', {});

  log('worker started — ingest every 30m, digest daily 13:00 UTC');
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
