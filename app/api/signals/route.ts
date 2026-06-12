import { NextResponse } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/api/auth';
import { getFeed, type FeedFilters } from '@/lib/feed/queries';
import { SignalTypeSchema, SourceSchema } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const actor = await authenticateRequest(req);
  if (!actor) return unauthorized();

  const q = new URL(req.url).searchParams;
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

  const { items, hasMore, total } = await getFeed(actor.orgId, filters, page);

  return NextResponse.json({
    total,
    page,
    hasMore,
    signals: items.map((s) => ({
      id: s.id,
      type: s.type,
      strength: s.strength,
      source: s.source,
      title: s.title,
      summary: s.summary,
      url: s.sourceUrl,
      justification: s.justification,
      company: s.companyName ? { id: s.companyId, name: s.companyName, domain: s.companyDomain } : null,
      person: s.personId ? { id: s.personId, name: s.personName } : null,
      published_at: s.publishedAt ?? s.ingestedAt,
    })),
  });
}
