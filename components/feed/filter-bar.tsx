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
  'h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function FilterBar({ options }: { options: FilterOption }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const active = params.toString().length > 0;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/80 px-6 py-3 backdrop-blur">
      <SlidersHorizontal className="size-4 text-muted-foreground" />

      <select className={selectCls} value={params.get('icpId') ?? ''} onChange={(e) => setParam('icpId', e.target.value)}>
        <option value="">All ICPs</option>
        {options.icps.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name.length > 36 ? i.name.slice(0, 36) + '…' : i.name}
          </option>
        ))}
      </select>

      <select className={selectCls} value={params.get('type') ?? ''} onChange={(e) => setParam('type', e.target.value)}>
        <option value="">All types</option>
        {options.types.map((t) => (
          <option key={t} value={t}>
            {SIGNAL_TYPE_LABELS[t as SignalType] ?? t}
          </option>
        ))}
      </select>

      <select className={selectCls} value={params.get('source') ?? ''} onChange={(e) => setParam('source', e.target.value)}>
        <option value="">All sources</option>
        {options.sources.map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABELS[s as SourceName] ?? s}
          </option>
        ))}
      </select>

      <select className={selectCls} value={params.get('minStrength') ?? ''} onChange={(e) => setParam('minStrength', e.target.value)}>
        <option value="">Any strength</option>
        <option value="0.4">≥ 40%</option>
        <option value="0.6">≥ 60%</option>
        <option value="0.8">≥ 80%</option>
      </select>

      <select className={selectCls} value={params.get('sinceDays') ?? ''} onChange={(e) => setParam('sinceDays', e.target.value)}>
        <option value="">Any time</option>
        <option value="1">Last 24h</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
      </select>

      {active && (
        <button
          onClick={() => router.replace(pathname, { scroll: false })}
          className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground')}
        >
          <X className="size-3" /> Clear
        </button>
      )}
    </div>
  );
}
