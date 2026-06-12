import { requireOrgId } from '@/lib/auth/session';
import { getFeed, getFeedFacets, type FeedFilters } from '@/lib/feed/queries';
import { listIcps } from '@/lib/icp/service';
import { SignalTypeSchema, SourceSchema } from '@/lib/types';
import { FilterBar } from '@/components/feed/filter-bar';
import { FeedList } from '@/components/feed/feed-list';
import { OnboardingCard } from '@/components/onboarding/onboarding-card';

export const metadata = { title: 'Feed — Signal Scout' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

function parseFilters(sp: SP): { filters: FeedFilters; query: string } {
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const filters: FeedFilters = {};
  const params = new URLSearchParams();

  if (get('icpId')) {
    filters.icpId = get('icpId');
    params.set('icpId', get('icpId')!);
  }
  const type = SignalTypeSchema.safeParse(get('type'));
  if (type.success) {
    filters.type = type.data;
    params.set('type', type.data);
  }
  const source = SourceSchema.safeParse(get('source'));
  if (source.success) {
    filters.source = source.data;
    params.set('source', source.data);
  }
  const minStrength = Number(get('minStrength'));
  if (Number.isFinite(minStrength) && minStrength > 0) {
    filters.minStrength = minStrength;
    params.set('minStrength', String(minStrength));
  }
  const sinceDays = Number(get('sinceDays'));
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    filters.sinceDays = sinceDays;
    params.set('sinceDays', String(sinceDays));
  }
  return { filters, query: params.toString() };
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<SP> }) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const { filters, query } = parseFilters(sp);

  const [{ items, hasMore, total }, facets, icpRows] = await Promise.all([
    getFeed(orgId, filters, 0),
    getFeedFacets(orgId),
    listIcps(orgId),
  ]);

  // brand-new account with nothing in the feed → guided onboarding
  const noFilters = !query;
  if (total === 0 && noFilters) {
    return <OnboardingCard hasIcp={icpRows.length > 0} />;
  }

  return (
    <div className="flex h-full flex-col">
      <FilterBar
        options={{
          icps: icpRows.map((i) => ({ id: i.id, name: i.name })),
          types: facets.types,
          sources: facets.sources,
        }}
      />
      <div className="flex-1">
        <FeedList key={query} initialItems={items} initialHasMore={hasMore} query={query} total={total} />
      </div>
    </div>
  );
}
