'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser, requireOrgId } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { organizations, users } from '@/lib/db/schema';

const nameSchema = z.string().trim().min(1).max(80);

/** Shape returned to the client Settings page. All fields are the signed-in
 * user's own workspace, so nothing here crosses a tenant boundary. */
export interface SettingsData {
  org: { name: string; plan: string } | null;
  members: { id: string; email: string | null; name: string | null; role: string }[];
  user: { id: string; email: string | null; name: string | null; role: string };
  /** Owners and admins may rename the workspace; everyone else sees it read-only. */
  canEditOrg: boolean;
}

/**
 * Load everything the Settings page renders, strictly scoped to the signed-in
 * user's own organization. Fails closed: if the user has no org yet we return
 * empty workspace/members rather than reading anything cross-tenant.
 */
export async function getSettingsData(): Promise<SettingsData> {
  const user = await requireUser();

  const orgRows = user.orgId
    ? await db
        .select({ name: organizations.name, plan: organizations.plan })
        .from(organizations)
        .where(eq(organizations.id, user.orgId))
        .limit(1)
    : [];

  const members = user.orgId
    ? await db
        .select({ id: users.id, email: users.email, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.orgId, user.orgId))
    : [];

  return {
    org: orgRows[0] ?? null,
    members,
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      role: user.role,
    },
    canEditOrg: user.role === 'owner' || user.role === 'admin',
  };
}

export async function updateOrgName(form: FormData) {
  const user = await requireUser();
  const orgId = await requireOrgId();
  // Only owners and admins may rename the organization.
  if (user.role !== 'owner' && user.role !== 'admin') return;

  const parsed = nameSchema.safeParse(form.get('name'));
  if (!parsed.success) return;

  await db.update(organizations).set({ name: parsed.data }).where(eq(organizations.id, orgId));
  revalidatePath('/settings');
}

export async function updateProfileName(form: FormData) {
  const user = await requireUser();

  const parsed = nameSchema.safeParse(form.get('name'));
  if (!parsed.success) return;

  await db.update(users).set({ name: parsed.data }).where(eq(users.id, user.id));
  revalidatePath('/settings');
}
