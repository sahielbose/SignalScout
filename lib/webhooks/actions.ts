'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOrgId } from '@/lib/auth/session';
import { SIGNAL_TYPES } from '@/lib/types';
import {
  createWebhook,
  deleteWebhook,
  setWebhookActive,
  testWebhook,
  updateWebhookEvents,
  updateWebhookFilters,
  WEBHOOK_EVENTS,
  type WebhookFilters,
} from './service';

export async function createWebhookAction(
  form: FormData,
): Promise<{ ok: boolean; secret?: string; error?: string }> {
  try {
    const orgId = await requireOrgId();
    const url = String(form.get('url') ?? '').trim();
    if (!url || !/^https?:\/\//.test(url)) {
      return { ok: false, error: 'Enter a valid http(s) URL' };
    }
    const row = await createWebhook(orgId, url, ['signal.created']);
    if (!row) return { ok: false, error: 'Could not create webhook' };
    revalidatePath('/integrations');
    return { ok: true, secret: row.secret };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteWebhookAction(form: FormData) {
  const orgId = await requireOrgId();
  const id = String(form.get('id') ?? '');
  if (id) await deleteWebhook(orgId, id);
  revalidatePath('/integrations');
}

export async function toggleWebhookAction(id: string, active: boolean): Promise<{ ok: boolean }> {
  const orgId = await requireOrgId();
  if (id) await setWebhookActive(orgId, id, active);
  revalidatePath('/integrations');
  return { ok: true };
}

export async function testWebhookAction(id: string): Promise<{ ok: boolean }> {
  const orgId = await requireOrgId();
  const ok = await testWebhook(orgId, id);
  return { ok };
}

const FiltersSchema = z.object({
  minStrength: z.number().min(0).max(1).optional(),
  signalTypes: z.array(z.enum(SIGNAL_TYPES)).optional(),
  icpIds: z.array(z.string().min(1)).optional(),
});

export async function updateWebhookFiltersAction(
  id: string,
  filters: WebhookFilters,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const orgId = await requireOrgId();
    if (!id) return { ok: false, error: 'Missing webhook' };
    const parsed = FiltersSchema.safeParse(filters);
    if (!parsed.success) return { ok: false, error: 'Those filter values are not valid' };
    await updateWebhookFilters(orgId, id, parsed.data);
    revalidatePath('/integrations');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const EventsSchema = z.array(z.enum(WEBHOOK_EVENTS));

export async function updateWebhookEventsAction(
  id: string,
  events: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const orgId = await requireOrgId();
    if (!id) return { ok: false, error: 'Missing webhook' };
    const parsed = EventsSchema.safeParse(events);
    if (!parsed.success) return { ok: false, error: 'Pick at least one valid event' };
    await updateWebhookEvents(orgId, id, parsed.data);
    revalidatePath('/integrations');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
