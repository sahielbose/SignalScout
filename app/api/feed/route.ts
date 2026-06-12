import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFeed, type FeedFilters } from '@/lib/feed/queries';
import { SignalTypeSchema, SourceSchema } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = url.searchParams;

  const filters: FeedFilters = {};
  if (q.get('icpId')) filters.icpId = q.get('icpId')!;
  const type = SignalTypeSchema.safeParse(q.get('type'));
  if (type.success) filters.type = type.data;
  const source = SourceSchema.safeParse(q.get('source'));
  if (source.success) filters.source = source.data;
  const minStrength = Number(q.get('minStrength'));
  if (Number.isFinite(minStrength) && minStrength > 0) filters.minStrength = minStrength;
  const sinceDays = Number(q.get('sinceDays'));
  if (Number.isFinite(sinceDays) && sinceDays > 0) filters.sinceDays = sinceDays;

  const page = Math.max(0, Number(q.get('page') ?? 0) || 0);
  const result = await getFeed(session.user.orgId, filters, page);
  return NextResponse.json(result);
}
