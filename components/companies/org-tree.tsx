'use client';

import { useCallback, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Crown,
  Code2,
  Boxes,
  TrendingUp,
  Users,
  Search,
  SlidersHorizontal,
  X,
  Bookmark,
  Check,
  Trash2,
  Rows3,
  Rows4,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CompanyPerson } from '@/lib/companies/queries';
import { SIGNAL_TYPE_LABELS, type SignalType } from '@/lib/types';
import { usePref } from '@/lib/hooks/use-pref';
import { saveViewAction, deleteViewAction } from '@/lib/views/actions';
import type { SavedView } from '@/lib/views/service';
import { cn } from '@/lib/utils';

const selectCls =
  'h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground transition-colors duration-200 hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const typeLabel = (t: string) => SIGNAL_TYPE_LABELS[t as SignalType] ?? t;

/** Query keys this toolbar owns. Used to detect "any filter active" and to build a saved view. */
const COMPANY_FILTER_KEYS = ['q', 'type', 'minSignals', 'sort'] as const;

/**
 * Department taxonomy for the enterprise account org-tree. We bucket people by
 * title keywords - a cheap, deterministic grouping (no model call). "Other"
 * absorbs anything we cannot confidently place.
 */
type DeptKey = 'Leadership' | 'Engineering' | 'Product' | 'Sales and GTM' | 'Other';

const DEPT_META: Record<DeptKey, { icon: LucideIcon; accent: string }> = {
  Leadership: { icon: Crown, accent: 'text-beacon' },
  Engineering: { icon: Code2, accent: 'text-primary' },
  Product: { icon: Boxes, accent: 'text-primary' },
  'Sales and GTM': { icon: TrendingUp, accent: 'text-primary' },
  Other: { icon: Users, accent: 'text-muted-foreground' },
};

const DEPT_ORDER: DeptKey[] = ['Leadership', 'Engineering', 'Product', 'Sales and GTM', 'Other'];

function departmentFor(title: string | null): DeptKey {
  const t = (title ?? '').toLowerCase();
  if (/\b(founder|ceo|cto|cfo|coo|chief|vp|head|president)\b/.test(t)) return 'Leadership';
  if (/\b(engineer|developer|platform|infra|infrastructure|sre|devops|backend|frontend)\b/.test(t)) return 'Engineering';
  if (/\b(product|pm|design|ux|ui)\b/.test(t)) return 'Product';
  if (/\b(sales|ae|gtm|go-to-market|revenue|growth|marketing|market)\b/.test(t)) return 'Sales and GTM';
  return 'Other';
}

/** Lower number = more senior, so people sort to the top of their department. */
function seniorityRank(title: string | null): number {
  const t = (title ?? '').toLowerCase();
  if (/\b(founder|ceo|cfo|cto|coo|chief|president)\b/.test(t)) return 0;
  if (/\b(vp|vice president|svp|evp)\b/.test(t)) return 1;
  if (/\b(head|director)\b/.test(t)) return 2;
  if (/\b(lead|principal|staff|manager)\b/.test(t)) return 3;
  if (/\b(senior|sr\.?)\b/.test(t)) return 4;
  if (t.trim().length > 0) return 5;
  return 6; // untitled - last
}

export function OrgTree({ people }: { people: CompanyPerson[] }) {
  if (people.length === 0) {
    return (
      <Card className="animate-scale-in p-6 text-center">
        <Users className="mx-auto mb-2 size-5 text-muted-foreground" />
        <p className="text-xs font-medium">No people found here yet</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-xs text-muted-foreground">
          As you research people at this company, they will show up here grouped by team so you can see who to reach out to.
        </p>
      </Card>
    );
  }

  const buckets = new Map<DeptKey, CompanyPerson[]>();
  for (const p of people) {
    const dept = departmentFor(p.title);
    if (!buckets.has(dept)) buckets.set(dept, []);
    buckets.get(dept)!.push(p);
  }

  const departments = DEPT_ORDER.filter((d) => buckets.has(d)).map((name) => ({
    name,
    people: buckets
      .get(name)!
      .slice()
      .sort((a, b) => seniorityRank(a.title) - seniorityRank(b.title) || a.name.localeCompare(b.name)),
  }));

  return (
    <div className="space-y-3">
      {departments.map((d, i) => {
        const meta = DEPT_META[d.name];
        const Icon = meta.icon;
        return (
          <Card
            key={d.name}
            className="animate-fade-up p-3"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Icon className={`size-3.5 ${meta.accent}`} />
                {d.name}
              </div>
              <Badge variant="muted">{d.people.length}</Badge>
            </div>
            <ul className="space-y-1.5">
              {d.people.map((p) => (
                <li key={p.id} className="flex flex-col">
                  <Link
                    href={`/people/${p.id}`}
                    className="text-sm font-medium hover:text-primary hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.title && <span className="text-xs text-muted-foreground">{p.title}</span>}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────── companies index toolbar ───────────────────────

export interface CompanyRow {
  id: string;
  name: string | null;
  domain: string | null;
  signals: number;
  lastAt: Date | string | null;
}

export interface CompaniesToolbarProps {
  /** Signal types this org actually has, for the "kind of buying moment" filter. */
  types: string[];
  /** Saved filter + sort setups for the companies page (surface "companies"). */
  savedViews: SavedView[];
}

const SORT_LABELS: Record<string, string> = {
  signals: 'Most buying signs',
  recent: 'Most recent',
  name: 'Name A to Z',
};

/**
 * Filter, sort, and saved-views bar for the companies index. Every control writes
 * to the URL so the result is shareable and bookmarkable; the server page reads
 * those params back. A "buying sign" is a public buying moment; an ICP is the kind
 * of customer you sell to.
 */
export function CompaniesToolbar({ types, savedViews }: CompaniesToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const hasFilters = COMPANY_FILTER_KEYS.some((k) => params.get(k));
  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    for (const k of COMPANY_FILTER_KEYS) next.delete(k);
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [params, pathname, router]);

  // ── saved views ──
  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState('');
  const [busy, setBusy] = useState(false);

  const currentParams = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const k of COMPANY_FILTER_KEYS) {
      const v = params.get(k);
      if (v) out[k] = v;
    }
    return out;
  }, [params]);

  const applyView = useCallback(
    (view: SavedView) => {
      const next = new URLSearchParams();
      for (const [k, v] of Object.entries(view.params)) next.set(k, v);
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  const onSave = useCallback(async () => {
    const name = viewName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await saveViewAction('companies', name, currentParams());
      setViewName('');
      setSaving(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [viewName, currentParams, router]);

  const onDelete = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await deleteViewAction('companies', id);
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const activeViewId = (() => {
    const cur = currentParams();
    const match = savedViews.find(
      (v) =>
        Object.keys(v.params).length === Object.keys(cur).length &&
        Object.entries(v.params).every(([k, val]) => cur[k] === val),
    );
    return match?.id ?? null;
  })();

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border bg-card/60 px-3 py-2.5 transition-opacity',
          isPending && 'opacity-70',
        )}
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="size-4" /> Filters
        </span>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search companies by name"
            placeholder="Search by company name"
            className="h-8 w-52 rounded-md border border-input bg-background pl-7 pr-2 text-xs text-foreground transition-colors duration-200 placeholder:text-muted-foreground hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={params.get('q') ?? ''}
            onChange={(e) => setParam('q', e.target.value)}
          />
        </div>

        <select
          aria-label="Filter by kind of buying moment (signal type)"
          className={selectCls}
          value={params.get('type') ?? ''}
          onChange={(e) => setParam('type', e.target.value)}
        >
          <option value="">Any kind of buying sign</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by the fewest number of buying signs"
          className={selectCls}
          value={params.get('minSignals') ?? ''}
          onChange={(e) => setParam('minSignals', e.target.value)}
        >
          <option value="">Any number of buying signs</option>
          <option value="2">2 or more buying signs</option>
          <option value="3">3 or more buying signs</option>
          <option value="5">5 or more buying signs</option>
          <option value="10">10 or more buying signs</option>
        </select>

        <select
          aria-label="Sort companies"
          className={selectCls}
          value={params.get('sort') ?? 'signals'}
          onChange={(e) => setParam('sort', e.target.value === 'signals' ? '' : e.target.value)}
        >
          <option value="signals">Sort: Most buying signs</option>
          <option value="recent">Sort: Most recent</option>
          <option value="name">Sort: Name A to Z</option>
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground active:scale-[0.98]"
          >
            <X className="size-3" /> Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {saving ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                aria-label="Name this view"
                placeholder="Name this view"
                className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave();
                  if (e.key === 'Escape') setSaving(false);
                }}
              />
              <button
                type="button"
                onClick={onSave}
                disabled={busy || !viewName.trim()}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="size-3.5" /> Save
              </button>
              <button
                type="button"
                onClick={() => setSaving(false)}
                className="inline-flex h-8 items-center rounded-md px-1.5 text-xs text-muted-foreground hover:text-foreground"
                aria-label="Cancel saving view"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSaving(true)}
              disabled={!hasFilters}
              title={hasFilters ? 'Save this filter and sort setup as a view' : 'Pick a filter or sort first, then save it as a view'}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <Bookmark className="size-3.5" /> Save view
            </button>
          )}
        </div>
      </div>

      {savedViews.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Your saved views:</span>
          {savedViews.map((v) => {
            const active = v.id === activeViewId;
            return (
              <span
                key={v.id}
                className={cn(
                  'group inline-flex items-center rounded-full border text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-background text-foreground hover:bg-accent',
                )}
              >
                <button
                  type="button"
                  onClick={() => applyView(v)}
                  className="inline-flex items-center gap-1 py-1 pl-2.5 pr-1 font-medium"
                  title="Apply this saved view"
                >
                  <Bookmark className={cn('size-3', active && 'fill-current')} />
                  {v.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(v.id)}
                  disabled={busy}
                  className="mr-1 inline-flex size-4 items-center justify-center rounded-full text-muted-foreground opacity-60 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label={`Delete saved view ${v.name}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────── companies index list (density-aware) ───────────────────────

/**
 * The list of watched companies. Lives client-side so the compact/comfortable
 * density toggle (a view-only preference) can change row spacing without a reload.
 */
export function CompaniesList({ companies: rows }: { companies: CompanyRow[] }) {
  const [density, setDensity] = usePref<'comfortable' | 'compact'>('companies:density', 'comfortable');
  const compact = density === 'compact';

  const rel = (d: Date | string | null) => {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    const secs = Math.round((Date.now() - date.getTime()) / 1000);
    if (Number.isNaN(secs)) return '';
    const day = 86400;
    if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))}m ago`;
    if (secs < day) return `${Math.round(secs / 3600)}h ago`;
    if (secs < day * 7) return `${Math.round(secs / day)}d ago`;
    if (secs < day * 30) return `${Math.round(secs / (day * 7))}w ago`;
    return `${Math.round(secs / (day * 30))}mo ago`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {rows.length} compan{rows.length === 1 ? 'y' : 'ies'} on your radar. Click one to open its timeline and team.
        </p>
        <div className="inline-flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
          <button
            type="button"
            onClick={() => setDensity('comfortable')}
            aria-pressed={!compact}
            title="Comfortable spacing"
            className={cn(
              'inline-flex size-6 items-center justify-center rounded transition-colors',
              !compact ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Rows3 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDensity('compact')}
            aria-pressed={compact}
            title="Compact spacing"
            className={cn(
              'inline-flex size-6 items-center justify-center rounded transition-colors',
              compact ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Rows4 className="size-3.5" />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="animate-scale-in p-8 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Search className="size-5" />
          </div>
          <p className="text-sm font-medium">No companies match these filters</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Try a different search term, widen the kind of buying sign, or lower the fewest number of buying signs.
          </p>
        </Card>
      ) : (
        <Card className="animate-fade-up divide-y">
          {rows.map((c, i) => (
            <Link
              key={c.id}
              href={`/companies/${c.id}`}
              className={cn(
                'group flex animate-fade-up items-center gap-3 transition-colors hover:bg-accent/40',
                compact ? 'p-2' : 'p-3',
              )}
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-md bg-muted text-muted-foreground',
                  compact ? 'size-7' : 'size-8',
                )}
              >
                <Boxes className={compact ? 'size-3.5' : 'size-4'} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium group-hover:text-primary">{c.name ?? c.domain ?? 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">
                  {c.domain ? `${c.domain} · ` : ''}
                  {c.signals} buying sign{c.signals === 1 ? '' : 's'}
                  {c.lastAt ? ` · last seen ${rel(c.lastAt)}` : ''}
                </div>
              </div>
              <TrendingUp className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─────────────────────── company detail: timeline type filter ───────────────────────

export interface TimelineTypeFilterProps {
  /** Each signal type present on this company plus its total count, for the chips. */
  byType: { type: string; count: number }[];
}

/**
 * Narrows the company's timeline to a single kind of buying moment. Writes the
 * choice to the `type` URL param so the server page re-queries the timeline.
 */
export function TimelineTypeFilter({ byType }: TimelineTypeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get('type') ?? '';

  const setType = useCallback(
    (value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set('type', value);
      else next.delete('type');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  if (byType.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setType('')}
        className={cn(
          'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
          active === ''
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-input bg-background text-muted-foreground hover:bg-accent',
        )}
      >
        All buying signs
      </button>
      {byType.map((t) => (
        <button
          key={t.type}
          type="button"
          onClick={() => setType(t.type)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
            active === t.type
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input bg-background text-muted-foreground hover:bg-accent',
          )}
        >
          {typeLabel(t.type)} <span className="opacity-70">{t.count}</span>
        </button>
      ))}
    </div>
  );
}
