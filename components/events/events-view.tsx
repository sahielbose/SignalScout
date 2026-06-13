'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Bookmark,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  FileSearch,
  Rows3,
  SlidersHorizontal,
  Sparkles,
  StretchHorizontal,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { SIGNAL_TYPE_LABELS, SOURCE_LABELS, type SignalType, type SourceName } from '@/lib/types';
import { strengthTone } from '@/lib/feed/signal-style';
import type { EventItem } from '@/lib/events/queries';
import type { SavedView } from '@/lib/views/service';
import { saveViewAction, deleteViewAction } from '@/lib/views/actions';
import { usePref } from '@/lib/hooks/use-pref';
import { cn, relativeTime, truncate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Higher-strength events get a brighter, "prioritized" treatment. */
const PRIORITY_THRESHOLD = 0.7;

/** The URL keys this surface controls, so a saved view can replace them cleanly. */
const FILTER_KEYS = ['within', 'type', 'minStrength', 'sort'] as const;

type Density = 'comfortable' | 'compact';

function cleanSummary(item: EventItem): string {
  const raw = (item.summary ?? '').replace(/^Event on [^:]+:\s*/i, '');
  return truncate(raw.replace(/\s+/g, ' ').trim(), 220);
}

function whyItMatters(item: EventItem): string {
  if (item.justification) return item.justification;
  const subject = item.companyName ?? item.personName;
  if (subject) {
    return `${subject} is tied to this event and looks like the kind of customer you sell to, so the people going are worth a closer look before you attend.`;
  }
  return 'This event fits the kind of customer you sell to, so the people going are worth scanning for good contacts before you attend.';
}

const selectCls =
  'h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground transition-colors duration-200 hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function EventCard({ item, density }: { item: EventItem; density: Density }) {
  const prioritized = (item.strength ?? 0) >= PRIORITY_THRESHOLD;
  const tone = strengthTone(item.strength);
  const pct = Math.round((item.strength ?? 0) * 100);
  const when = item.date ?? item.ingestedAt;
  const name = item.title || item.companyName || 'Event';
  const sourceLabel = SOURCE_LABELS[item.source as SourceName] ?? item.source;
  const summary = cleanSummary(item);
  const compact = density === 'compact';

  return (
    <article
      className={cn(
        'rounded-lg border border-l-2 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md',
        compact ? 'p-3' : 'p-4',
        prioritized ? 'border-l-beacon ring-1 ring-beacon/30' : 'border-l-rose-500/70',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 font-medium text-rose-700">
          <CalendarDays className="size-3" />
          Event
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{sourceLabel}</span>
        {prioritized && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-beacon/15 px-2 py-0.5 font-medium text-beacon"
            title="Strong fit for the kind of customer you sell to, worth your time"
          >
            <Sparkles className="size-3" />
            Worth your time
          </span>
        )}
        <span className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" />
          {relativeTime(when)}
        </span>
        <div className="ml-auto flex items-center gap-2" title={`${pct}% sign this fits the kind of customer you sell to`}>
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500 ease-out', prioritized ? 'bg-beacon' : 'bg-primary')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={cn('font-mono text-xs font-medium', tone.cls)}>{pct}%</span>
        </div>
      </div>

      <div className={compact ? 'mt-2' : 'mt-3'}>
        <h3 className="font-semibold leading-snug">{name}</h3>
        {item.companyName && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {item.companyId ? (
              <Link href={`/companies/${item.companyId}`} className="hover:text-primary hover:underline">
                {item.companyName}
              </Link>
            ) : (
              item.companyName
            )}
            {item.companyDomain ? ` · ${item.companyDomain}` : ''}
          </div>
        )}
        {summary && !compact && <p className="mt-1 text-sm text-muted-foreground">{summary}</p>}
        {!compact && (
          <p className="mt-2 text-xs italic text-muted-foreground/80">
            <span className="font-medium not-italic text-foreground/70">Why it matters: </span>
            {whyItMatters(item)}
          </p>
        )}
      </div>

      {item.personId && item.personName && (
        <div className={cn('rounded-md border border-beacon/30 bg-beacon/5', compact ? 'mt-2 p-2' : 'mt-3 p-3')}>
          <div
            className="flex items-center gap-1.5 text-xs font-medium text-beacon"
            title="Going to this event and already matches the kind of customer you sell to"
          >
            <UserCheck className="size-3.5" />
            Worth meeting here
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/people/${item.personId}`} className="text-sm font-medium hover:text-primary hover:underline">
                {item.personName}
              </Link>
              {item.personTitle && <span className="ml-1 text-xs text-muted-foreground">{item.personTitle}</span>}
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/people/${item.personId}`}>
                <FileSearch className="size-3.5" /> Research
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div className={cn('flex items-center gap-1.5', compact ? 'mt-2' : 'mt-3')}>
        {item.sourceUrl && (
          <Button asChild size="sm" variant="ghost" className="ml-auto">
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" /> Open event
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

export function EventsView({
  events,
  eventTypes,
  savedViews,
  hasFilters,
}: {
  events: EventItem[];
  eventTypes: string[];
  savedViews: SavedView[];
  hasFilters: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // View-only preference: how tightly the cards are packed. Persists locally.
  const [density, setDensity] = usePref<Density>('events-density', 'comfortable');

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
    for (const k of FILTER_KEYS) next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  // Apply a saved view: replace exactly the filter keys with the saved ones.
  const applyView = useCallback(
    (view: SavedView | undefined) => {
      if (!view) return;
      const next = new URLSearchParams();
      for (const k of FILTER_KEYS) {
        const v = view.params[k];
        if (v) next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  // The current filter/sort state, as a plain object, to save as a view.
  const currentParams = useMemo(() => {
    const out: Record<string, string> = {};
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (v) out[k] = v;
    }
    return out;
  }, [params]);

  const onSave = useCallback(() => {
    const name = viewName.trim();
    if (!name) {
      setSaveErr('Give the view a name');
      return;
    }
    setSaveErr(null);
    startTransition(async () => {
      const res = await saveViewAction('events', name, currentParams);
      if (res.ok) {
        setViewName('');
        setSaving(false);
      } else {
        setSaveErr(res.error ?? 'Could not save the view');
      }
    });
  }, [viewName, currentParams]);

  const onDelete = useCallback((id: string) => {
    startTransition(async () => {
      await deleteViewAction('events', id);
    });
  }, []);

  const withAttendees = events.filter((e) => e.personId && e.personName);
  const sort = params.get('sort') ?? 'soonest';
  const noFilterParams = Object.keys(currentParams).length === 0;

  return (
    <div className="space-y-5">
      {/* Filter, sort, density, and saved-view controls. */}
      <div className="rounded-lg border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="size-4" /> Narrow these events
          </span>

          <select
            aria-label="Show events happening within"
            title="How far ahead to look for events"
            className={selectCls}
            value={params.get('within') ?? ''}
            onChange={(e) => setParam('within', e.target.value)}
          >
            <option value="">Any date</option>
            <option value="7">Next 7 days</option>
            <option value="30">Next 30 days</option>
            <option value="90">Next 90 days</option>
          </select>

          <select
            aria-label="Filter by type of public buying moment"
            title="A signal is a public buying moment. Filter by its type."
            className={selectCls}
            value={params.get('type') ?? ''}
            onChange={(e) => setParam('type', e.target.value)}
          >
            <option value="">All event types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {SIGNAL_TYPE_LABELS[t as SignalType] ?? t}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by how strong the buying sign is"
            title="Strength is how strong a buying sign it is, from 0 to 100%."
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
            aria-label="Sort the events"
            title="Choose the order of the list"
            className={selectCls}
            value={sort}
            onChange={(e) => setParam('sort', e.target.value === 'soonest' ? '' : e.target.value)}
          >
            <option value="soonest">Sort: Soonest first</option>
            <option value="recent">Sort: Most recent first</option>
            <option value="strongest">Sort: Strongest sign first</option>
          </select>

          {!noFilterParams && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground active:scale-[0.98]"
            >
              <X className="size-3" /> Clear filters
            </button>
          )}

          {/* Density toggle: how tightly the cards are packed. View-only. */}
          <div className="ml-auto inline-flex items-center gap-1 rounded-md border border-input p-0.5" role="group" aria-label="List density">
            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              aria-pressed={density === 'comfortable'}
              title="Comfortable: roomy cards with full details"
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium transition-colors',
                density === 'comfortable' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <StretchHorizontal className="size-3.5" /> Comfortable
            </button>
            <button
              type="button"
              onClick={() => setDensity('compact')}
              aria-pressed={density === 'compact'}
              title="Compact: tighter cards, more events per screen"
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium transition-colors',
                density === 'compact' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Rows3 className="size-3.5" /> Compact
            </button>
          </div>
        </div>

        {/* Saved views: re-apply a named filter+sort setup, or delete one. */}
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
                    title="Apply this saved filter and sort setup"
                    className="px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(v.id)}
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
            <span className="text-xs text-muted-foreground/80">None yet. Set filters above, then save them as a view.</span>
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
              disabled={noFilterParams}
              title={noFilterParams ? 'Set at least one filter or sort first' : 'Save the current filters and sort as a named view'}
            >
              <Bookmark className="size-3.5" /> Save current view
            </Button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-rose-500/15 text-rose-700">
            <CalendarDays className="size-4" />
          </div>
          <p className="mt-3 text-sm font-medium">No events match these filters</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? 'Try widening the date range, lowering the strength, or clearing the filters above.'
              : 'Once we spot a meetup or conference that fits the customers you sell to, it lands here.'}
          </p>
          {!noFilterParams && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              <X className="size-3.5" /> Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-beacon/30 bg-beacon/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-beacon">
              <UserCheck className="size-4" />
              Who is worth meeting
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              What matters at an event is not the venue, it is who is in the room. Below we pull out the people going who
              already look like the kind of customer you sell to, so you can plan those conversations before you walk in.
            </p>
            <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground/90">
              <li>1. Scan the events below for ones that fit your customers.</li>
              <li>2. Note the people flagged as worth meeting at each one.</li>
              <li>3. Open Research on a person to get a sourced profile before you go.</li>
            </ol>
            {withAttendees.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {withAttendees.map((e) => (
                  <li key={`att-${e.id}`}>
                    <Link
                      href={`/people/${e.personId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-beacon/40 bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-beacon/10"
                    >
                      <UserCheck className="size-3 text-beacon" />
                      {e.personName}
                      {e.personTitle ? <span className="text-muted-foreground">· {e.personTitle}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground/80">
                No matching people linked to these events yet. As we connect attendees to the customers you sell to, they
                will show up here as people worth meeting.
              </p>
            )}
          </section>

          <div className={cn('grid', density === 'compact' ? 'gap-2' : 'gap-3')}>
            {events.map((e) => (
              <EventCard key={e.id} item={e} density={density} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
