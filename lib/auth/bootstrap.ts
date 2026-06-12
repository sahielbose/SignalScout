import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { organizations, users, auditLogs } from '@/lib/db/schema';

function workspaceNameFor(email?: string | null, name?: string | null): string {
  if (name && name.trim()) return `${name.split(' ')[0]}'s workspace`;
  if (email && email.includes('@')) {
    const domain = email.split('@')[1]!;
    const base = domain.split('.')[0]!;
    return `${base.charAt(0).toUpperCase()}${base.slice(1)} workspace`;
  }
  return 'My workspace';
}

/**
 * Ensure a user is attached to an org. Idempotent.
 * First user of a fresh org becomes its `owner`. Records an audit log on creation.
 * Returns the user's orgId.
 */
export async function ensureOrgForUser(userId: string): Promise<string | null> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  if (u.orgId) return u.orgId;

  const [org] = await db
    .insert(organizations)
    .values({ name: workspaceNameFor(u.email, u.name) })
    .returning();
  if (!org) return null;

  await db
    .update(users)
    .set({ orgId: org.id, role: 'owner' })
    .where(eq(users.id, userId));

  await db.insert(auditLogs).values({
    orgId: org.id,
    actor: u.email ?? userId,
    action: 'org.created',
    subjectType: 'organization',
    subjectId: org.id,
    detail: { via: 'first_login' },
  });

  return org.id;
}

/**
 * Dev/credentials path (no OAuth): upsert a user by email, then ensure their org.
 * Used by the development "Continue without a provider" sign-in and by tests.
 */
export async function ensureUserWithOrg(
  email: string,
  name?: string | null,
): Promise<{ id: string; email: string; name: string | null; orgId: string | null }> {
  const normalized = email.trim().toLowerCase();
  let [u] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (!u) {
    [u] = await db
      .insert(users)
      .values({ email: normalized, name: name ?? null, emailVerified: new Date() })
      .returning();
  }
  if (!u) throw new Error('failed to upsert user');
  const orgId = await ensureOrgForUser(u.id);
  return { id: u.id, email: normalized, name: u.name, orgId };
}
