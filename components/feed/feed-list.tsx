'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Radar } from 'lucide-react';
import type { FeedItem } from '@/lib/feed/queries';
import { usePref } from '@/lib/hooks/use-pref';
import { FEED_DENSITY_EVENT, type FeedDensity } from './filter-bar';
import { SignalCard } from './signal-card';
import { toast } from '@/lib/toast';
import { addToListAction } from '@/lib/lists/actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function FeedList({
  initialItems,
  initialHasMore,
  query,
  total,
  showCleared = false,
  icpNames,
  loadMore: loadMoreAction,
}: {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  query: string; // serialized filters (without page)
  total: number;
  showCleared?: boolean;
  /** Map of the org's ICP id to name, for the per-card strength explainer. */
  icpNames?: Record<string, string>;
  /** Server action that runs the same org-scoped query for the next page. */
  loadMore: (query: string, page: number) => Promise<{ items: FeedItem[]; hasMore: boolean }>;
}) {
  // View-only density preference, shared with the filter bar's toggle. The bar
  // broadcasts changes so the list re-renders live without waiting for a remount.
  const [density, setDensity] = usePref<FeedDensity>('feed-density', 'comfortable');
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<FeedDensity>).detail;
      if (detail === 'comfortable' || detail === 'compact') setDensity(detail);
    };
    window.addEventListener(FEED_DENSITY_EVENT, onChange);
    return () => window.removeEventListener(FEED_DENSITY_EVENT, onChange);
  }, [setDensity]);
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // reset when filters change (key also remounts, but guard anyway)
  useEffect(() => {
    setItems(initialItems);
    setPage(0);
    setHasMore(initialHasMore);
  }, [initialItems, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const next = page + 1;
      // Use the server action so every filter (sort, search, multi-select) is
      // applied on the next page, exactly as on the first.
      const data = await loadMoreAction(query, next);
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setPage(next);
    } catch {
      toast('Could not load more signals', 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, query, loadMoreAction]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '600px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // When the worklist view is hiding cleared items, removing one from the list
  // keeps the inbox-zero feel. In the "show cleared" view we keep it visible and
  // let the server revalidation refresh its status badge.
  const onCleared = useCallback(
    (item: FeedItem) => {
      if (!showCleared) setItems((prev) => prev.filter((it) => it.id !== item.id));
    },
    [showCleared],
  );

  const onReopened = useCallback((item: FeedItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'open', snoozedUntil: null } : it)),
    );
  }, []);

  const onAddToList = useCallback(async (item: FeedItem) => {
    const kind = item.companyId ? 'company' : item.personId ? 'person' : null;
    const entityId = item.companyId ?? item.personId;
    if (!kind || !entityId) {
      toast('Run deep research first to add a person', 'default');
      return;
    }
    const r = await addToListAction({ kind, entityId });
    toast(
      r.ok ? `Added ${item.companyName ?? item.personName ?? 'signal'} to “Saved”` : r.error ?? 'Could not add to list',
      r.ok ? 'success' : 'error',
    );
  }, []);

  if (items.length === 0) {
    // This view only renders once the org has signals; an empty result here means
    // the current filters (or the cleared view) hide everything. Guide accordingly.
    const filtersApplied = new URLSearchParams(query)
      .toString()
      .replace(/(^|&)showCleared=1/, '')
      .length > 0;
    return (
      <div className="mx-auto max-w-md animate-fade-up py-20 text-center">
        <Radar className="mx-auto size-8 animate-pulse-ring text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">No signals to show here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtersApplied
            ? 'Nothing matches your current filters. Widen the time range or strength, or clear the filters to see everything.'
            : showCleared
              ? 'Nothing has been cleared yet. Signals you mark Actioned, Snooze, or Dismiss will appear here.'
              : 'You are all caught up. New buying signals will appear here as the worker finds them.'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto max-w-3xl p-6', density === 'compact' ? 'space-y-2' : 'space-y-3')}>
      <p className="text-xs text-muted-foreground">
        {total} matching signal{total === 1 ? '' : 's'}
        {showCleared ? '' : ' to work through'}
      </p>
      {items.map((item, i) => (
        <div
          key={item.id}
          className="animate-fade-up"
          style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}
        >
          <SignalCard
            item={item}
            density={density}
            icpNames={icpNames}
            onAddToList={onAddToList}
            onCleared={onCleared}
            onReopened={onReopened}
          />
        </div>
      ))}
      <div ref={sentinel} className="h-1" />
      {loading && (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      )}
      {hasMore && !loading && (
        <div className="flex justify-center py-4">
          <Button variant="outline" size="sm" onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
