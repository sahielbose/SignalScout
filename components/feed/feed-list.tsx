'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Radar } from 'lucide-react';
import type { FeedItem } from '@/lib/feed/queries';
import { SignalCard } from './signal-card';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';

export function FeedList({
  initialItems,
  initialHasMore,
  query,
  total,
}: {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  query: string; // serialized filters (without page)
  total: number;
}) {
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
      const res = await fetch(`/api/feed?${query}${query ? '&' : ''}page=${next}`);
      if (!res.ok) throw new Error('failed to load');
      const data = (await res.json()) as { items: FeedItem[]; hasMore: boolean };
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setPage(next);
    } catch {
      toast('Could not load more signals', 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, query]);

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

  const onAddToList = useCallback((item: FeedItem) => {
    // Lists are wired in Phase 8; surface the affordance honestly for now.
    toast(`Saved “${item.companyName ?? item.personName ?? 'signal'}” — manage lists on the Lists page`, 'success');
  }, []);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <Radar className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          No signals match these filters yet. Define an ICP and let the worker ingest sources, or relax the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-6">
      <p className="text-xs text-muted-foreground">{total} matched signal{total === 1 ? '' : 's'}</p>
      {items.map((item) => (
        <SignalCard key={item.id} item={item} onAddToList={onAddToList} />
      ))}
      <div ref={sentinel} className="h-1" />
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {loading ? 'Loading' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
