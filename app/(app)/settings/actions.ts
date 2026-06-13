'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser, requireOrgId } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { organizations, users } from '@/lib/db/schema';

const nameSchema = z.string().trim().min(1).max(80);

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
