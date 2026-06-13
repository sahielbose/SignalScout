import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { webhooks, deliveries } from '@/lib/db/schema';
import { signWebhook } from '@/lib/delivery/webhook';
import { SIGNAL_TYPES, type SignalType } from '@/lib/types';

/** Per-webhook delivery filters. Empty / undefined means "no constraint". */
export interface WebhookFilters {
  /** How strong a buying sign it must be (0..1) before we POST this webhook. */
  minStrength?: number;
  /** Only fire for these signal kinds (a public buying moment, e.g. funding). Empty = any. */
  signalTypes?: string[];
  /** Only fire for signals matched to these ICPs (kinds of customer). Empty = any. */
  icpIds?: string[];
}

/**
 * The events a webhook can subscribe to. Today we emit `signal.created` when a
 * new public buying moment lands; `ping` is a manual test event only.
 */
export const WEBHOOK_EVENTS = ['signal.created'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export async function createWebhook(orgId: string, url: string, events: string[]) {
  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  const [row] = await db
    .insert(webhooks)
    .values({ orgId, url, secret, events: events.length ? events : ['signal.created'], filters: {} })
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

/** Validate + persist a webhook's per-delivery filters (org-scoped, fail closed). */
export async function updateWebhookFilters(orgId: string, id: string, filters: WebhookFilters) {
  const clean: WebhookFilters = {};

  if (typeof filters.minStrength === 'number' && Number.isFinite(filters.minStrength)) {
    clean.minStrength = Math.min(1, Math.max(0, filters.minStrength));
  }

  if (Array.isArray(filters.signalTypes)) {
    const allowed = new Set<string>(SIGNAL_TYPES);
    const types = [...new Set(filters.signalTypes.filter((t) => allowed.has(t)))];
    if (types.length) clean.signalTypes = types;
  }

  if (Array.isArray(filters.icpIds)) {
    const ids = [...new Set(filters.icpIds.filter((v): v is string => typeof v === 'string' && v.length > 0))];
    if (ids.length) clean.icpIds = ids;
  }

  await db
    .update(webhooks)
    .set({ filters: clean })
    .where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)));
  return clean;
}

/** Persist which events a webhook subscribes to (org-scoped, fail closed). */
export async function updateWebhookEvents(orgId: string, id: string, events: string[]) {
  const allowed = new Set<string>(WEBHOOK_EVENTS);
  const clean = [...new Set(events.filter((e) => allowed.has(e)))];
  // Always keep at least one event so the webhook stays meaningful.
  const next = clean.length ? clean : ['signal.created'];
  await db
    .update(webhooks)
    .set({ events: next })
    .where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)));
  return next;
}

export interface WebhookRow {
  id: string;
  orgId: string | null;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  filters: WebhookFilters;
}

/** Does a signal pass this webhook's per-delivery filters? */
export function signalMatchesWebhookFilters(
  filters: WebhookFilters | null | undefined,
  signal: { type: SignalType | string | null; strength: number | null; matchedIcpIds: string[] },
): boolean {
  if (!filters) return true;

  if (typeof filters.minStrength === 'number' && (signal.strength ?? 0) < filters.minStrength) {
    return false;
  }

  if (filters.signalTypes && filters.signalTypes.length > 0) {
    if (!signal.type || !filters.signalTypes.includes(signal.type)) return false;
  }

  if (filters.icpIds && filters.icpIds.length > 0) {
    const overlap = signal.matchedIcpIds.some((id) => filters.icpIds!.includes(id));
    if (!overlap) return false;
  }

  return true;
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
