'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/auth/session';
import { createWebhook, deleteWebhook, setWebhookActive, testWebhook } from './service';

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
