'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { setByoKey } from './service';

export async function saveByoKeyAction(key: string): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: 'Not signed in.' };
  const trimmed = key.trim();
  if (trimmed && !trimmed.startsWith('sk-ant-')) {
    return { ok: false, error: 'Expected an Anthropic API key (starts with sk-ant-…).' };
  }
  await setByoKey(s.user.id, trimmed || null);
  revalidatePath('/usage');
  return { ok: true };
}

export async function clearByoKeyAction() {
  const s = await auth();
  if (!s?.user?.id) return;
  await setByoKey(s.user.id, null);
  revalidatePath('/usage');
}
