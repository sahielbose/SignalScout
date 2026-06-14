'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Bookmark,
  CalendarRange,
  Check,
  Layers,
  Trash2,
  X,
} from 'lucide-react';
import type { SavedView } from '@/lib/views/service';
import { saveViewAction, deleteViewAction } from '@/lib/views/actions';
import { usePref } from '@/lib/hooks/use-pref';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Point = { day: string; cost: number; calls: number };
type KindRow = { day: string; total: number } & Record<string, number>;

/** The URL keys this surface owns, so a saved view can replace them cleanly. */
export const METRICS_FILTER_KEYS = ['range', 'chart', 'sigType'] as const;

/** A short, readable label per kind of model call for the chart legend. */
const KIND_LABELS: Record<string, string> = {
  classify: 'Labeling signals',
  dossier: 'Research profiles',
};
function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/**
 * A small, theme-friendly palette for the stacked "by kind" view. Cycled by
 * index so any number of kinds gets a distinct, warm-toned color.
 */
const KIND_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--beacon))',
  'hsl(265 60% 55%)',
  'hsl(200 70% 45%)',
  'hsl(330 60% 55%)',
  'hsl(150 50% 40%)',
];
function kindColor(i: number): string {
  return KIND_COLORS[i % KIND_COLORS.length]!;
}

const selectCls =
  'h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground transition-colors duration-200 hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function TotalChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
        />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          labelFormatter={(label: string) => `Day ${label}`}
          formatter={(value: number, _name, item) => {
            const calls = (item?.payload as Point | undefined)?.calls ?? 0;
            return [`$${Number(value).toFixed(4)} · ${calls} call${calls === 1 ? '' : 's'}`, 'AI spend'];
          }}
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#costFill)"
          isAnimationActive
          animationDuration={500}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KindChart({ data, kinds }: { data: KindRow[]; kinds: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
        />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          labelFormatter={(label: string) => `Day ${label}`}
          formatter={(value: number, name) => [`$${Number(value).toFixed(4)}`, kindLabel(String(name))]}
        />
        <Legend
          formatter={(value: string) => <span className="text-xs text-muted-foreground">{kindLabel(value)}</span>}
          iconType="circle"
        />
        {kinds.map((k, i) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            stackId="kinds"
            stroke={kindColor(i)}
            strokeWidth={1.5}
            fill={kindColor(i)}
            fillOpacity={0.35}
            isAnimationActive
            animationDuration={500}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

/**
 * The interactive Metrics surface: pick how many days of AI spend to show,
 * switch the chart between day-by-day and split-by-kind, filter the accuracy
 * table to one signal type (a public buying moment), and save the whole setup
 * as a named view. All controls write to the URL so the view is shareable.
 */
export function CostChart({
  series,
  kindSeries,
  kinds,
  byKind,
  range,
  chartMode,
  sigType,
  signalTypes,
  signalTypeLabels,
  savedViews,
}: {
  series: Point[];
  kindSeries: KindRow[];
  kinds: string[];
  byKind: { kind: string; cost: number; calls: number }[];
  range: number;
  chartMode: 'day' | 'kind';
  sigType: string;
  /** Signal types present in the accuracy table, for the filter dropdown. */
  signalTypes: string[];
  signalTypeLabels: Record<string, string>;
  savedViews: SavedView[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // View-only preference: remember the user's preferred chart split locally so
  // it is the default next visit. The URL still wins when it carries a `chart`
  // value (shareable links); the stored preference only fills in when the URL
  // is silent about the split, so the control is never a dead toggle.
  const [prefChart, setPrefChart] = usePref<'day' | 'kind'>('metrics-chart', 'day');
  const urlChart = params.get('chart');
  const appliedPref = useRef(false);
  useEffect(() => {
    // Only on first mount, and only when the URL has not specified a split:
    // adopt the saved preference if it differs from the current (default) URL.
    if (appliedPref.current) return;
    appliedPref.current = true;
    if (!urlChart && prefChart === 'kind') {
      const next = new URLSearchParams(params.toString());
      next.set('chart', 'kind');
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefChart, urlChart]);

  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState('');
  const [saveErr, setSaveErr] = useState<string | null>(null);

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

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    for (const k of METRICS_FILTER_KEYS) next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const applyView = useCallback(
    (view: SavedView) => {
      const next = new URLSearchParams();
      for (const k of METRICS_FILTER_KEYS) {
        const v = view.params[k];
        if (v) next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const currentParams = useMemo(() => {
    const out: Record<string, string> = {};
    for (const k of METRICS_FILTER_KEYS) {
      const v = params.get(k);
      if (v) out[k] = v;
    }
    return out;
  }, [params]);

  const hasActiveParams = Object.keys(currentParams).length > 0;

  const onSave = useCallback(() => {
    const name = viewName.trim();
    if (!name) {
      setSaveErr('Give the view a name');
      return;
    }
    setSaveErr(null);
    startTransition(async () => {
      const res = await saveViewAction('metrics', name, currentParams);
      if (res.ok) {
        setViewName('');
        setSaving(false);
        toast(`Saved view "${name}"`, 'success');
        router.refresh();
      } else {
        setSaveErr(res.error ?? 'Could not save the view');
      }
    });
  }, [viewName, currentParams, router]);

  const onDelete = useCallback(
    (view: SavedView) => {
      startTransition(async () => {
        const res = await deleteViewAction('metrics', view.id);
        if (res.ok) {
          toast(`Deleted view "${view.name}"`, 'success');
          router.refresh();
        }
      });
    },
    [router],
  );

  const setChartMode = useCallback(
    (mode: 'day' | 'kind') => {
      setPrefChart(mode);
      setParam('chart', mode === 'day' ? '' : 'kind');
    },
    [setParam, setPrefChart],
  );

  const totalCost = byKind.reduce((s, k) => s + k.cost, 0);
  const totalCalls = byKind.reduce((s, k) => s + k.calls, 0);
  const canSplitByKind = kinds.length > 0;
  const effectiveMode: 'day' | 'kind' = chartMode === 'kind' && canSplitByKind ? 'kind' : 'day';

  return (
    <div className="space-y-3">
      {/* Controls: date range, chart split, accuracy-table type filter. */}
      <div className="rounded-lg border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarRange className="size-4" /> Date range
          </label>
          <select
            aria-label="How many days of AI spend to show"
            title="How far back to show AI spend"
            className={selectCls}
            value={String(range)}
            onChange={(e) => setParam('range', e.target.value === '14' ? '' : e.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>

          {/* Chart split: total spend per day, or spend broken out by kind of call. */}
          <div className="inline-flex items-center gap-1 rounded-md border border-input p-0.5" role="group" aria-label="Chart breakdown">
            <button
              type="button"
              onClick={() => setChartMode('day')}
              aria-pressed={effectiveMode === 'day'}
              title="Show total AI spend day by day"
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium transition-colors',
                effectiveMode === 'day' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <BarChart3 className="size-3.5" /> By day
            </button>
            <button
              type="button"
              onClick={() => canSplitByKind && setChartMode('kind')}
              aria-pressed={effectiveMode === 'kind'}
              disabled={!canSplitByKind}
              title={
                canSplitByKind
                  ? 'Split the spend by kind of model call (labeling signals vs research profiles)'
                  : 'No spend to split by kind in this range yet'
              }
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                effectiveMode === 'kind' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Layers className="size-3.5" /> By kind
            </button>
          </div>

          {hasActiveParams && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground active:scale-[0.98]"
            >
              <X className="size-3" /> Reset
            </button>
          )}
        </div>

        {/* Saved views: re-apply a named range + chart + table setup, or delete one. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Bookmark className="size-4" /> Saved views
          </span>

          {savedViews.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-1.5">
              {savedViews.map((v) => (
                <li key={v.id} className="inline-flex items-center overflow-hidden rounded-full border border-input bg-background">
                  <button
                    type="button"
                    onClick={() => applyView(v)}
                    title="Apply this saved range, chart, and table setup"
                    className="px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(v)}
                    disabled={isPending}
                    title="Delete this saved view"
                    aria-label={`Delete saved view ${v.name}`}
                    className="border-l border-input px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-xs text-muted-foreground/80">None yet. Pick a range or filter above, then save it as a view.</span>
          )}

          {saving ? (
            <div className="ml-auto inline-flex items-center gap-1.5">
              <input
                autoFocus
                value={viewName}
                onChange={(e) => {
                  setViewName(e.target.value);
                  if (saveErr) setSaveErr(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave();
                  if (e.key === 'Escape') {
                    setSaving(false);
                    setViewName('');
                    setSaveErr(null);
                  }
                }}
                placeholder="Name this view"
                maxLength={60}
                aria-label="Name for the saved view"
                className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button size="sm" onClick={onSave} disabled={isPending}>
                <Check className="size-3.5" /> Save
              </Button>
              <button
                type="button"
                onClick={() => {
                  setSaving(false);
                  setViewName('');
                  setSaveErr(null);
                }}
                className="rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              {saveErr && <span className="text-xs text-rose-600">{saveErr}</span>}
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => setSaving(true)}
              disabled={!hasActiveParams}
              title={hasActiveParams ? 'Save the current range, chart, and table setup as a named view' : 'Pick a range or filter first'}
            >
              <Bookmark className="size-3.5" /> Save current view
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {effectiveMode === 'kind'
            ? 'Spend split by kind of model call, stacked, over the chosen range.'
            : 'Total AI spend, day by day, over the chosen range.'}
        </p>
        <span className="text-xs text-muted-foreground" title="Total across the chosen range for your org.">
          {fmtUsd(totalCost)} · {totalCalls} call{totalCalls === 1 ? '' : 's'} in range
        </span>
      </div>

      {effectiveMode === 'kind' ? <KindChart data={kindSeries} kinds={kinds} /> : <TotalChart data={series} />}

      {/* Breakdown chips for the chosen range, so the by-kind totals stay visible
          even in the day-by-day chart. */}
      <div className="flex flex-wrap gap-2">
        {byKind.length > 0 ? (
          byKind.map((k, i) => (
            <span
              key={k.kind}
              className="animate-pop inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <span className="size-2 rounded-full" style={{ background: kindColor(i) }} aria-hidden />
              {kindLabel(k.kind)}: {k.calls} call{k.calls === 1 ? '' : 's'} · {fmtUsd(k.cost)}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground/80">No spend in this range yet.</span>
        )}
      </div>
    </div>
  );
}
