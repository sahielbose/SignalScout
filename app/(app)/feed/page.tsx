import Link from 'next/link';
import { z } from 'zod';
import { requireOrgId } from '@/lib/auth/session';
import { getFeed, getFeedFacets, type FeedFilters } from '@/lib/feed/queries';
import { listIcps } from '@/lib/icp/service';
import { SignalTypeSchema, SourceSchema } from '@/lib/types';
import { FilterBar } from '@/components/feed/filter-bar';
import { FeedList } from '@/components/feed/feed-list';
import { OnboardingCard } from '@/components/onboarding/onboarding-card';

export const metadata = { title: 'Feed - Signal Scout' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

function parseFilters(sp: SP): { filters: FeedFilters; query: string } {
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const filters: FeedFilters = {};
  const params = new URLSearchParams();

  const icpId = z.string().uuid().safeParse(get('icpId'));
  if (icpId.success) {
    filters.icpId = icpId.data;
    params.set('icpId', icpId.data);
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
  if (get('showCleared') === '1') {
    filters.showCleared = true;
    params.set('showCleared', '1');
  }
  return { filters, query: params.toString() };
}

/** Build the href to the feed with `showCleared` flipped, preserving filters. */
function toggleClearedHref(query: string, showCleared: boolean): string {
  const params = new URLSearchParams(query);
  if (showCleared) params.delete('showCleared');
  else params.set('showCleared', '1');
  const q = params.toString();
  return q ? `/feed?${q}` : '/feed';
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
  const showCleared = filters.showCleared === true;
  const noFilters = !query;
  if (total === 0 && noFilters) {
    return <OnboardingCard hasIcp={icpRows.length > 0} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="animate-fade-down">
        <FilterBar
          options={{
            icps: icpRows.map((i) => ({ id: i.id, name: i.name })),
            types: facets.types,
            sources: facets.sources,
          }}
        />
        <div className="flex items-center justify-end px-6 pt-3">
          <Link
            href={toggleClearedHref(query, showCleared)}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {showCleared ? 'Hide cleared' : 'Show cleared'}
          </Link>
        </div>
      </div>
      <div className="flex-1">
        <FeedList
          key={query}
          initialItems={items}
          initialHasMore={hasMore}
          query={query}
          total={total}
          showCleared={showCleared}
        />
      </div>
    </div>
  );
}
