'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/auth/session';
import { createWebhook, deleteWebhook, testWebhook } from './service';

export async function createWebhookAction(form: FormData) {
  const orgId = await requireOrgId();
  const url = String(form.get('url') ?? '').trim();
  if (url && /^https?:\/\//.test(url)) await createWebhook(orgId, url, ['signal.created']);
  revalidatePath('/integrations');
}

export async function deleteWebhookAction(form: FormData) {
  const orgId = await requireOrgId();
  const id = String(form.get('id') ?? '');
  if (id) await deleteWebhook(orgId, id);
  revalidatePath('/integrations');
}

export async function testWebhookAction(id: string): Promise<{ ok: boolean }> {
  const orgId = await requireOrgId();
  const ok = await testWebhook(orgId, id);
  return { ok };
}
