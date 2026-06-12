import { and, arrayOverlaps, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signals, companies, deliveries } from '@/lib/db/schema';
import { getOrgIcpIds } from '@/lib/feed/queries';
import { listWebhooks, sendWebhook, type WebhookRow } from '@/lib/webhooks/service';
import { postSlack, formatSlackMessage } from './slack';
import { env } from '@/lib/env';

export interface DispatchResult {
  notified: number;
  webhooks: number;
  slack: boolean;
}

/**
 * Notify on NEW high-strength, ICP-matched signals: signed webhooks + Slack.
 * Deduped via a 'signal_notify' delivery row per signal id, so each signal fires
 * exactly once. CRM push stays an explicit, gated action — never here.
 */
export async function dispatchSignalNotifications(orgId: string, minStrength = 0.7): Promise<DispatchResult> {
  const orgIcpIds = await getOrgIcpIds(orgId);
  if (orgIcpIds.length === 0) return { notified: 0, webhooks: 0, slack: false };

  const candidates = await db
    .select({
      id: signals.id,
      type: signals.type,
      strength: signals.strength,
      title: signals.title,
      summary: signals.rawContent,
      url: signals.sourceUrl,
      source: signals.source,
      company: companies.name,
    })
    .from(signals)
    .leftJoin(companies, eq(signals.companyId, companies.id))
    .where(and(arrayOverlaps(signals.matchedIcpIds, orgIcpIds), gte(signals.strength, minStrength)))
    .orderBy(desc(signals.ingestedAt))
    .limit(50);

  if (candidates.length === 0) return { notified: 0, webhooks: 0, slack: false };

  const deliveredRows = await db
    .select({ sigId: sql<string>`${deliveries.detail}->>'signalId'` })
    .from(deliveries)
    .where(and(eq(deliveries.orgId, orgId), eq(deliveries.kind, 'signal_notify')));
  const delivered = new Set(deliveredRows.map((r) => r.sigId));
  const fresh = candidates.filter((c) => !delivered.has(c.id));
  if (fresh.length === 0) return { notified: 0, webhooks: 0, slack: false };

  const hooks = (await listWebhooks(orgId)).filter((w) => w.active && w.events.includes('signal.created')) as WebhookRow[];
  let webhookCount = 0;
  for (const hook of hooks) {
    const ok = await sendWebhook(hook, 'signal.created', { signals: fresh });
    if (ok) webhookCount++;
  }

  const slackUrl = env().SLACK_WEBHOOK_URL;
  let slackOk = false;
  if (slackUrl) slackOk = await postSlack(slackUrl, formatSlackMessage(fresh));

  // mark delivered (dedupe)
  if (fresh.length) {
    await db.insert(deliveries).values(
      fresh.map((c) => ({ orgId, kind: 'signal_notify', target: '-', status: 'sent', detail: { signalId: c.id } })),
    );
  }

  return { notified: fresh.length, webhooks: webhookCount, slack: slackOk };
}
