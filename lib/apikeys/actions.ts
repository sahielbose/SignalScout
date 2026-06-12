'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/auth/session';
import { createApiKey, revokeApiKey } from './service';

export async function createKeyAction(name: string): Promise<{ ok: boolean; key?: string; prefix?: string; error?: string }> {
  try {
    const orgId = await requireOrgId();
    const created = await createApiKey(orgId, name);
    revalidatePath('/integrations');
    return { ok: true, key: created.key, prefix: created.prefix };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function revokeKeyAction(form: FormData) {
  const orgId = await requireOrgId();
  const id = String(form.get('id') ?? '');
  if (id) await revokeApiKey(orgId, id);
  revalidatePath('/integrations');
}
