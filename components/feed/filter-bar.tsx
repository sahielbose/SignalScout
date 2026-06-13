'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ArrowDownWideNarrow, LayoutList, Rows3, Search, SlidersHorizontal, X } from 'lucide-react';
import { SIGNAL_TYPE_LABELS, SOURCE_LABELS, type SignalType, type SourceName } from '@/lib/types';
import { usePref } from '@/lib/hooks/use-pref';
import type { SavedView } from '@/lib/views/service';
import { SavedViews } from './saved-views';
import { cn } from '@/lib/utils';

export interface FilterOption {
  icps: { id: string; name: string }[];
  types: string[];
  sources: string[];
}

/** Density of the feed list. A view-only preference (stored per browser). */
export type FeedDensity = 'comfortable' | 'compact';

/** Broadcast a density change so sibling components update live (no remount). */
export const FEED_DENSITY_EVENT = 'ss:feed-density';

const selectCls =
  'h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground transition-colors duration-200 hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** The query keys that narrow or order the feed. `showCleared` is a view toggle. */
const FILTER_KEYS = ['icpId', 'type', 'source', 'minStrength', 'sinceDays', 'q', 'sort'] as const;

/** Read a comma-separated multi-select param into a string array. */
function readMulti(params: URLSearchParams, key: string): string[] {
  return (params.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function FilterBar({ options, savedViews }: { options: FilterOption; savedViews: SavedView[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [density, setDensityPref] = usePref<FeedDensity>('feed-density', 'comfortable');
  const setDensity = useCallback(
    (value: FeedDensity) => {
      setDensityPref(value);
      // Tell the feed list (a sibling component) to update without a remount.
      window.dispatchEvent(new CustomEvent<FeedDensity>(FEED_DENSITY_EVENT, { detail: value }));
    },
    [setDensityPref],
  );

  // Keep the search box snappy: type locally, push to the URL after a short pause.
  const [searchText, setSearchText] = useState(params.get('q') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replaceParams = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      replaceParams(next);
    },
    [params, replaceParams],
  );

  // Toggle one value inside a comma-separated multi-select param.
  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const current = readMulti(params, key);
      const exists = current.includes(value);
      const next = exists ? current.filter((v) => v !== value) : [...current, value];
      const out = new URLSearchParams(params.toString());
      if (next.length) out.set(key, next.join(','));
      else out.delete(key);
      replaceParams(out);
    },
    [params, replaceParams],
  );

  // Reflect external URL changes (e.g. applying a saved view) back into the box.
  const urlQ = params.get('q') ?? '';
  useEffect(() => {
    setSearchText(urlQ);
  }, [urlQ]);

  const onSearchChange = useCallback(
    (value: string) => {
      setSearchText(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setParam('q', value.trim()), 300);
    },
    [setParam],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const selectedTypes = readMulti(params, 'type');
  const selectedSources = readMulti(params, 'source');

  const hasFilters = FILTER_KEYS.some((k) => params.get(k));
  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    setSearchText('');
    replaceParams(next);
  }, [params, replaceParams]);

  return (
    <div className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-background/80 px-6 py-3 backdrop-blur">
      {/* Row 1: search, sort, density, saved views */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search by company, title, or content"
            placeholder="Search company, title, or text"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground transition-colors duration-200 hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ArrowDownWideNarrow className="size-4" />
          <span className="sr-only sm:not-sr-only">Sort</span>
          <select
            aria-label="Sort signals"
            className={selectCls}
            value={params.get('sort') ?? 'newest'}
            onChange={(e) => setParam('sort', e.target.value === 'newest' ? '' : e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="strongest">Strongest buying sign</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>

        {/* Density: how tightly the list is packed (a per-browser preference). */}
        <div
          className="inline-flex h-8 items-center rounded-md border border-input p-0.5"
          role="group"
          aria-label="List density"
        >
          <button
            type="button"
            title="Comfortable rows"
            aria-pressed={density === 'comfortable'}
            onClick={() => setDensity('comfortable')}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors duration-150',
              density === 'comfortable' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Rows3 className="size-3.5" /> Comfortable
          </button>
          <button
            type="button"
            title="Compact rows"
            aria-pressed={density === 'compact'}
            onClick={() => setDensity('compact')}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors duration-150',
              density === 'compact' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutList className="size-3.5" /> Compact
          </button>
        </div>

        <div className="ml-auto">
          <SavedViews views={savedViews} />
        </div>
      </div>

      {/* Row 2: filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="size-4" /> Filters
        </span>

        <select
          aria-label="Filter by customer type (the kind of customer you sell to)"
          className={selectCls}
          value={params.get('icpId') ?? ''}
          onChange={(e) => setParam('icpId', e.target.value)}
        >
          <option value="">All customer types</option>
          {options.icps.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name.length > 36 ? i.name.slice(0, 36) + '…' : i.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by how strong the buying sign is"
          className={selectCls}
          value={params.get('minStrength') ?? ''}
          onChange={(e) => setParam('minStrength', e.target.value)}
        >
          <option value="">Any strength</option>
          <option value="0.4">Strength 40%+</option>
          <option value="0.6">Strength 60%+</option>
          <option value="0.8">Strength 80%+</option>
        </select>

        <select
          aria-label="Filter by how recent the signal is"
          className={selectCls}
          value={params.get('sinceDays') ?? ''}
          onChange={(e) => setParam('sinceDays', e.target.value)}
        >
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
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground active:scale-[0.98]',
            )}
          >
            <X className="size-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Row 3: multi-select chips for signal type */}
      {options.types.length > 0 && (
        <ChipGroup
          label="Signal type"
          hint="a signal is a public buying moment"
          items={options.types.map((t) => ({
            value: t,
            label: SIGNAL_TYPE_LABELS[t as SignalType] ?? t,
          }))}
          selected={selectedTypes}
          onToggle={(v) => toggleMulti('type', v)}
        />
      )}

      {/* Row 4: multi-select chips for source */}
      {options.sources.length > 0 && (
        <ChipGroup
          label="Source"
          items={options.sources.map((s) => ({
            value: s,
            label: SOURCE_LABELS[s as SourceName] ?? s,
          }))}
          selected={selectedSources}
          onToggle={(v) => toggleMulti('source', v)}
        />
      )}
    </div>
  );
}

/** A labeled row of toggleable filter chips (pick several at once). */
function ChipGroup({
  label,
  hint,
  items,
  selected,
  onToggle,
}: {
  label: string;
  hint?: string;
  items: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground" title={hint}>
        {label}
      </span>
      {items.map((it) => {
        const active = selected.includes(it.value);
        return (
          <button
            key={it.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(it.value)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors duration-150',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background text-muted-foreground hover:border-ring/60 hover:text-foreground',
            )}
          >
            {it.label}
            {active && <X className="size-3" />}
          </button>
        );
      })}
    </div>
  );
}
