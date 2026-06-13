import { NextResponse } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/api/auth';
import { globalSearch } from '@/lib/search/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const actor = await authenticateRequest(req);
  if (!actor) return unauthorized();

  const q = new URL(req.url).searchParams.get('q') ?? '';
  const results = await globalSearch(actor.orgId, q);
  return NextResponse.json(results);
}
