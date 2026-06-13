'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId, requireUser } from '@/lib/auth/session';
import { createSavedView, deleteSavedView } from './service';

/** Save the current filter/sort state of a page as a named view. */
export async function saveViewAction(
  surface: string,
  name: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const orgId = await requireOrgId();
  const user = await requireUser().catch(() => null);
  const row = await createSavedView(orgId, user?.id ?? null, surface, name, params ?? {});
  if (!row) return { ok: false, error: 'Give the view a name' };
  revalidatePath(`/${surface === 'feed' ? 'feed' : surface}`);
  return { ok: true };
}

export async function deleteViewAction(surface: string, id: string): Promise<{ ok: boolean }> {
  const orgId = await requireOrgId();
  await deleteSavedView(orgId, id);
  revalidatePath(`/${surface === 'feed' ? 'feed' : surface}`);
  return { ok: true };
}
