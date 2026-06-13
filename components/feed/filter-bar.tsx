'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { SIGNAL_TYPE_LABELS, SOURCE_LABELS, type SignalType, type SourceName } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface FilterOption {
  icps: { id: string; name: string }[];
  types: string[];
  sources: string[];
}

const selectCls =
  'h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground transition-colors duration-200 hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** The query keys that narrow the feed. `showCleared` is a view toggle, not a filter. */
const FILTER_KEYS = ['icpId', 'type', 'source', 'minStrength', 'sinceDays'] as const;

export function FilterBar({ options }: { options: FilterOption }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Only count real filters as "active" so the Clear button reflects what it
  // actually clears. Clearing keeps the Show/Hide-cleared view toggle intact.
  const hasFilters = FILTER_KEYS.some((k) => params.get(k));
  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/80 px-6 py-3 backdrop-blur">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <SlidersHorizontal className="size-4" /> Filters
      </span>

      <select aria-label="Filter by customer type (ICP)" className={selectCls} value={params.get('icpId') ?? ''} onChange={(e) => setParam('icpId', e.target.value)}>
        <option value="">All customer types</option>
        {options.icps.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name.length > 36 ? i.name.slice(0, 36) + '…' : i.name}
          </option>
        ))}
      </select>

      <select aria-label="Filter by signal type" className={selectCls} value={params.get('type') ?? ''} onChange={(e) => setParam('type', e.target.value)}>
        <option value="">All signal types</option>
        {options.types.map((t) => (
          <option key={t} value={t}>
            {SIGNAL_TYPE_LABELS[t as SignalType] ?? t}
          </option>
        ))}
      </select>

      <select aria-label="Filter by source" className={selectCls} value={params.get('source') ?? ''} onChange={(e) => setParam('source', e.target.value)}>
        <option value="">All sources</option>
        {options.sources.map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABELS[s as SourceName] ?? s}
          </option>
        ))}
      </select>

      <select aria-label="Filter by how strong the buying sign is" className={selectCls} value={params.get('minStrength') ?? ''} onChange={(e) => setParam('minStrength', e.target.value)}>
        <option value="">Any strength</option>
        <option value="0.4">Strength 40%+</option>
        <option value="0.6">Strength 60%+</option>
        <option value="0.8">Strength 80%+</option>
      </select>

      <select aria-label="Filter by how recent the signal is" className={selectCls} value={params.get('sinceDays') ?? ''} onChange={(e) => setParam('sinceDays', e.target.value)}>
        <option value="">Any time</option>
        <option value="1">Last 24h</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground active:scale-[0.98]')}
        >
          <X className="size-3" /> Clear filters
        </button>
      )}
    </div>
  );
}
