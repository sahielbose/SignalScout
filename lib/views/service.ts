import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { savedViews } from '@/lib/db/schema';

export interface SavedView {
  id: string;
  surface: string;
  name: string;
  params: Record<string, string>;
}

/** Named filter + sort setups for a page, shared across the workspace. */
export async function listSavedViews(orgId: string, surface: string): Promise<SavedView[]> {
  const rows = await db
    .select({ id: savedViews.id, surface: savedViews.surface, name: savedViews.name, params: savedViews.params })
    .from(savedViews)
    .where(and(eq(savedViews.orgId, orgId), eq(savedViews.surface, surface)))
    .orderBy(desc(savedViews.createdAt));
  return rows;
}

export async function createSavedView(
  orgId: string,
  createdBy: string | null,
  surface: string,
  name: string,
  params: Record<string, string>,
): Promise<SavedView | null> {
  const clean = name.trim().slice(0, 60);
  if (!clean) return null;
  const [row] = await db
    .insert(savedViews)
    .values({ orgId, createdBy: createdBy ?? null, surface, name: clean, params })
    .returning({ id: savedViews.id, surface: savedViews.surface, name: savedViews.name, params: savedViews.params });
  return row ?? null;
}

export async function deleteSavedView(orgId: string, id: string): Promise<void> {
  await db.delete(savedViews).where(and(eq(savedViews.id, id), eq(savedViews.orgId, orgId)));
}
