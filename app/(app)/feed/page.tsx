import Link from 'next/link';
import { requireOrgId } from '@/lib/auth/session';
import {
  getFeed,
  getFeedFacets,
  parseFeedFilters,
  type FeedFilters,
  type FeedItem,
} from '@/lib/feed/queries';
import { listIcps } from '@/lib/icp/service';
import { listSavedViews } from '@/lib/views/service';
import { PageHeader } from '@/components/app/page-header';
import { FilterBar } from '@/components/feed/filter-bar';
import { FeedList } from '@/components/feed/feed-list';
import { OnboardingCard } from '@/components/onboarding/onboarding-card';

export const metadata = { title: 'Feed - Signal Scout' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

/** Keys that narrow or order the feed. `showCleared` is a view toggle, not a filter. */
const FEED_PARAM_KEYS = ['icpId', 'type', 'source', 'minStrength', 'sinceDays', 'q', 'sort'] as const;

/** Turn the raw searchParams into a clean, canonical query string. */
function canonicalQuery(sp: SP): string {
  const params = new URLSearchParams();
  for (const k of [...FEED_PARAM_KEYS, 'showCleared']) {
    const v = sp[k];
    if (typeof v === 'string' && v.trim()) params.set(k, v.trim());
  }
  // Re-derive through the parser so only valid values survive into the URL.
  const filters = parseFeedFilters(params);
  return filtersToQuery(filters);
}

/** Serialize a parsed filter set back to a stable query string. */
function filtersToQuery(filters: FeedFilters): string {
  const params = new URLSearchParams();
  if (filters.icpId) params.set('icpId', filters.icpId);
  const types = filters.types ?? (filters.type ? [filters.type] : []);
  if (types.length) params.set('type', types.join(','));
  const sources = filters.sources ?? (filters.source ? [filters.source] : []);
  if (sources.length) params.set('source', sources.join(','));
  if (filters.search) params.set('q', filters.search);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.minStrength != null) params.set('minStrength', String(filters.minStrength));
  if (filters.sinceDays != null) params.set('sinceDays', String(filters.sinceDays));
  if (filters.showCleared) params.set('showCleared', '1');
  return params.toString();
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
  const query = canonicalQuery(sp);
  const filters = parseFeedFilters(new URLSearchParams(query));

  // Server action for infinite scroll. Runs the same org-scoped query as the
  // first page, so every new filter (sort, search, multi-select) keeps working
  // when loading more, without depending on the public REST route.
  async function loadMore(q: string, page: number): Promise<{ items: FeedItem[]; hasMore: boolean }> {
    'use server';
    const orgId2 = await requireOrgId();
    const f = parseFeedFilters(new URLSearchParams(q));
    const safePage = Math.max(0, Math.floor(Number(page) || 0));
    const { items, hasMore } = await getFeed(orgId2, f, safePage);
    return { items, hasMore };
  }

  const [{ items, hasMore, total }, facets, icpRows, savedViews] = await Promise.all([
    getFeed(orgId, filters, 0),
    getFeedFacets(orgId),
    listIcps(orgId),
    listSavedViews(orgId, 'feed'),
  ]);

  // brand-new account with nothing in the feed → guided onboarding
  const showCleared = filters.showCleared === true;
  const noFilters = !query;
  if (total === 0 && noFilters) {
    return <OnboardingCard hasIcp={icpRows.length > 0} />;
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Signal feed"
        description="A live list of public moments that suggest a company is ready to buy, kept to the kinds of customers you sell to."
      />
      <div className="animate-fade-down">
        <FilterBar
          options={{
            icps: icpRows.map((i) => ({ id: i.id, name: i.name })),
            types: facets.types,
            sources: facets.sources,
          }}
          savedViews={savedViews}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-3 text-xs text-muted-foreground">
          <p>
            Narrow the list with the filters above, then act on each signal: open the source, run deep research,
            or clear it with Actioned, Snooze, or Dismiss.
          </p>
          <Link
            href={toggleClearedHref(query, showCleared)}
            className="shrink-0 font-medium underline-offset-4 hover:text-foreground hover:underline"
          >
            {showCleared ? 'Hide cleared signals' : 'Show cleared signals'}
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
          loadMore={loadMore}
        />
      </div>
    </div>
  );
}
