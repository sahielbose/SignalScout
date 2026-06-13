import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { webhooks, deliveries } from '@/lib/db/schema';
import { signWebhook } from '@/lib/delivery/webhook';

export async function createWebhook(orgId: string, url: string, events: string[]) {
  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  const [row] = await db
    .insert(webhooks)
    .values({ orgId, url, secret, events: events.length ? events : ['signal.created'] })
    .returning();
  return row;
}

export async function listWebhooks(orgId: string) {
  return db.select().from(webhooks).where(eq(webhooks.orgId, orgId)).orderBy(desc(webhooks.createdAt));
}

export async function deleteWebhook(orgId: string, id: string) {
  await db.delete(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)));
}

export async function setWebhookActive(orgId: string, id: string, active: boolean) {
  await db
    .update(webhooks)
    .set({ active })
    .where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)));
}

export interface WebhookRow {
  id: string;
  orgId: string | null;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

/** POST a signed event to one webhook; records a delivery row. */
export async function sendWebhook(webhook: WebhookRow, eventType: string, data: unknown): Promise<boolean> {
  const body = JSON.stringify({ type: eventType, created: Date.now(), data });
  const { signature } = signWebhook(webhook.secret, body);
  let status = 'sent';
  let detail: Record<string, unknown> = {};
  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SignalScout-Signature': signature,
        'X-SignalScout-Event': eventType,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    status = res.ok ? 'sent' : 'failed';
    detail = { httpStatus: res.status };
  } catch (err) {
    status = 'failed';
    detail = { error: (err as Error).message };
  }
  await db.insert(deliveries).values({ orgId: webhook.orgId, kind: 'webhook', target: webhook.url, status, detail });
  return status === 'sent';
}

export async function testWebhook(orgId: string, id: string): Promise<boolean> {
  const [w] = await db.select().from(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId))).limit(1);
  if (!w) return false;
  return sendWebhook(w, 'ping', { message: 'Signal Scout test event', ok: true });
}
