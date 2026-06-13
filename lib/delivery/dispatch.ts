import { and, arrayOverlaps, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signals, companies, deliveries, icps } from '@/lib/db/schema';
import { getOrgIcpIds } from '@/lib/feed/queries';
import { listWebhooks, sendWebhook, signalMatchesWebhookFilters, type WebhookRow } from '@/lib/webhooks/service';
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
 * exactly once. CRM push stays an explicit, gated action - never here.
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
      matchedIcpIds: signals.matchedIcpIds,
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

  // Load the matched ICP definitions (org-scoped) so per-ICP notify prefs and
  // notifyThreshold actually gate delivery. A signal can match several ICPs;
  // we honor the most permissive (lowest threshold) of its matching ICPs.
  const matchedIds = [...new Set(fresh.flatMap((c) => c.matchedIcpIds))];
  const icpRows = matchedIds.length
    ? await db
        .select({ id: icps.id, definition: icps.definition })
        .from(icps)
        .where(and(eq(icps.orgId, orgId), inArray(icps.id, matchedIds)))
    : [];
  const icpById = new Map(icpRows.map((r) => [r.id, r.definition]));

  // True when at least one of the signal's matching ICPs clears its threshold.
  const passesThreshold = (c: (typeof fresh)[number]): boolean =>
    c.matchedIcpIds.some((id) => {
      const def = icpById.get(id);
      return !!def && (c.strength ?? 0) >= def.notifyThreshold;
    });

  // True when at least one matching ICP wants Slack AND the signal clears that ICP's threshold.
  const wantsSlack = (c: (typeof fresh)[number]): boolean =>
    c.matchedIcpIds.some((id) => {
      const def = icpById.get(id);
      return !!def && def.notify.slack && (c.strength ?? 0) >= def.notifyThreshold;
    });

  // Webhooks respect each ICP's notifyThreshold AND each webhook's own filters
  // (minimum strength, chosen signal types, chosen ICPs). A webhook only fires
  // when it has at least one signal that clears both gates, and we POST it only
  // the subset of signals it actually asked for.
  const webhookSignals = fresh.filter(passesThreshold);
  const hooks = (await listWebhooks(orgId)).filter(
    (w) => w.active && w.events.includes('signal.created'),
  ) as WebhookRow[];
  let webhookCount = 0;
  if (webhookSignals.length) {
    for (const hook of hooks) {
      const forHook = webhookSignals.filter((c) =>
        signalMatchesWebhookFilters(hook.filters, {
          type: c.type,
          strength: c.strength,
          matchedIcpIds: c.matchedIcpIds,
        }),
      );
      if (forHook.length === 0) continue;
      const ok = await sendWebhook(hook, 'signal.created', { signals: forHook });
      if (ok) webhookCount++;
    }
  }

  // Slack: only signals whose matching ICP opted in to Slack and cleared its threshold.
  // NOTE: destination is still the global SLACK_WEBHOOK_URL - a per-org Slack URL
  // would need a new schema column, which is out of scope here.
  const slackSignals = fresh.filter(wantsSlack);
  const slackUrl = env().SLACK_WEBHOOK_URL;
  let slackOk = false;
  if (slackUrl && slackSignals.length) slackOk = await postSlack(slackUrl, formatSlackMessage(slackSignals));

  // mark delivered (dedupe)
  if (fresh.length) {
    await db.insert(deliveries).values(
      fresh.map((c) => ({ orgId, kind: 'signal_notify', target: '-', status: 'sent', detail: { signalId: c.id } })),
    );
  }

  return { notified: fresh.length, webhooks: webhookCount, slack: slackOk };
}
