import { redirect } from 'next/navigation';
import { auth } from './index';

export async function getSession() {
  return auth();
}

/** Server-component guard: returns the authed user or redirects to /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return session.user;
}

/** Returns the current org id, redirecting to login if unauthenticated. */
export async function requireOrgId(): Promise<string> {
  const user = await requireUser();
  if (!user.orgId) redirect('/login');
  return user.orgId;
}

export async function getOrgId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.orgId ?? null;
}
