'use server';

import { and, arrayOverlaps, eq, isNotNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { organizations, users, signals, icps, lists, dossiers } from '@/lib/db/schema';
import { getOrgIcpIds } from '@/lib/feed/queries';
import { getByoKey } from '@/lib/users/service';

const nameSchema = z.string().trim().min(1).max(80);

/** Update the signed-in user's display name and refresh the profile + settings. */
export async function updateMyName(form: FormData) {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(form.get('name'));
  if (!parsed.success) return;
  await db.update(users).set({ name: parsed.data }).where(eq(users.id, user.id));
  revalidatePath('/profile');
  revalidatePath('/settings');
}

export interface ProfileData {
  user: { id: string; name: string | null; email: string | null; role: string };
  org: { name: string; plan: string } | null;
  icps: { id: string; name: string }[];
  stats: { companies: number; signals: number; lists: number; dossiers: number; members: number };
  /** True when the signed-in user has their own AI key saved. */
  byoKey: boolean;
}

const n = (v: { n: number }[] | undefined): number => v?.[0]?.n ?? 0;

/**
 * Everything the Profile page renders, strictly scoped to the signed-in user's
 * own organization. Fails closed: with no org we return zeros rather than
 * reading anything cross-tenant.
 */
export async function getProfileData(): Promise<ProfileData> {
  const user = await requireUser();
  const base = {
    user: { id: user.id, name: user.name ?? null, email: user.email ?? null, role: user.role },
  };

  if (!user.orgId) {
    return { ...base, org: null, icps: [], stats: { companies: 0, signals: 0, lists: 0, dossiers: 0, members: 0 }, byoKey: false };
  }
  const orgId = user.orgId;

  const [orgRow] = await db
    .select({ name: organizations.name, plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const icpRows = await db
    .select({ id: icps.id, name: icps.name })
    .from(icps)
    .where(eq(icps.orgId, orgId))
    .orderBy(icps.createdAt);

  const orgIcpIds = await getOrgIcpIds(orgId);

  const companies = orgIcpIds.length
    ? n(
        await db
          .select({ n: sql<number>`count(distinct ${signals.companyId})::int` })
          .from(signals)
          .where(and(isNotNull(signals.companyId), arrayOverlaps(signals.matchedIcpIds, orgIcpIds))),
      )
    : 0;
  const signalCount = orgIcpIds.length
    ? n(
        await db
          .select({ n: sql<number>`count(*)::int` })
          .from(signals)
          .where(arrayOverlaps(signals.matchedIcpIds, orgIcpIds)),
      )
    : 0;
  const listCount = n(await db.select({ n: sql<number>`count(*)::int` }).from(lists).where(eq(lists.orgId, orgId)));
  const dossierCount = n(await db.select({ n: sql<number>`count(*)::int` }).from(dossiers).where(eq(dossiers.orgId, orgId)));
  const memberCount = n(await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.orgId, orgId)));

  const byo = await getByoKey(user.id);

  return {
    ...base,
    org: orgRow ?? null,
    icps: icpRows,
    stats: { companies, signals: signalCount, lists: listCount, dossiers: dossierCount, members: memberCount },
    byoKey: !!byo,
  };
}
