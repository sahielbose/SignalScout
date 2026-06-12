import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { verifyApiKey } from '@/lib/apikeys/service';

export interface ApiActor {
  orgId: string;
  via: 'key' | 'session';
}

/**
 * Authenticate a REST request via Authorization: Bearer <api key>, falling back
 * to a logged-in session cookie (so the dashboard can call the same endpoints).
 */
export async function authenticateRequest(req: Request): Promise<ApiActor | null> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const raw = header.slice(7).trim();
    const verified = await verifyApiKey(raw);
    if (verified) return { orgId: verified.orgId, via: 'key' };
    return null; // a provided-but-invalid key should NOT silently fall through to session
  }
  const session = await auth();
  if (session?.user?.orgId) return { orgId: session.user.orgId, via: 'session' };
  return null;
}

export function unauthorized() {
  return NextResponse.json(
    { error: 'unauthorized', detail: 'Provide a valid `Authorization: Bearer <api key>` or sign in.' },
    { status: 401 },
  );
}
