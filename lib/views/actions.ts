'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId, requireUser } from '@/lib/auth/session';
import { createSavedView, deleteSavedView } from './service';

/**
 * Map a saved-view surface to its real route. The "metrics" surface lives at
 * /evals (the sidebar just labels it Metrics), and the "list" surface lives on
 * the dynamic /lists/[id] detail page. Revalidating the wrong path silently
 * leaves the chip bar stale.
 */
function revalidateSurface(surface: string): void {
  if (surface === 'metrics') revalidatePath('/evals');
  else if (surface === 'list') revalidatePath('/lists/[id]', 'page');
  else revalidatePath(`/${surface}`);
}

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
  revalidateSurface(surface);
  return { ok: true };
}

export async function deleteViewAction(surface: string, id: string): Promise<{ ok: boolean }> {
  const orgId = await requireOrgId();
  await deleteSavedView(orgId, id);
  revalidateSurface(surface);
  return { ok: true };
}
