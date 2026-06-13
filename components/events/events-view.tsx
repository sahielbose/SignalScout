import Link from 'next/link';
import { CalendarDays, ExternalLink, FileSearch, MapPin, Sparkles, UserCheck } from 'lucide-react';
import { SOURCE_LABELS, type SourceName } from '@/lib/types';
import { strengthTone } from '@/lib/feed/signal-style';
import type { EventItem } from '@/lib/events/queries';
import { cn, relativeTime, truncate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Higher-strength events get a brighter, "prioritized" treatment. */
const PRIORITY_THRESHOLD = 0.7;

function cleanSummary(item: EventItem): string {
  const raw = (item.summary ?? '').replace(/^Event on [^:]+:\s*/i, '');
  return truncate(raw.replace(/\s+/g, ' ').trim(), 220);
}

function whyItMatters(item: EventItem): string {
  if (item.justification) return item.justification;
  const subject = item.companyName ?? item.personName;
  if (subject) {
    return `${subject} is connected to this event and overlaps with your ICP, so the attendee pool likely includes warm contacts worth prioritizing.`;
  }
  return 'This event matched one of your active ICPs, so its attendees are worth scanning for warm contacts before you go.';
}

function EventCard({ item }: { item: EventItem }) {
  const prioritized = (item.strength ?? 0) >= PRIORITY_THRESHOLD;
  const tone = strengthTone(item.strength);
  const pct = Math.round((item.strength ?? 0) * 100);
  const when = item.date ?? item.ingestedAt;
  const name = item.title || item.companyName || 'Event';
  const sourceLabel = SOURCE_LABELS[item.source as SourceName] ?? item.source;

  return (
    <article
      className={cn(
        'rounded-lg border border-l-2 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md',
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
          <span className="inline-flex items-center gap-1 rounded-full bg-beacon/15 px-2 py-0.5 font-medium text-beacon">
            <Sparkles className="size-3" />
            Prioritized
          </span>
        )}
        <span className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className="size-3" />
          {relativeTime(when)}
        </span>
        <div className="ml-auto flex items-center gap-2" title={`ICP match strength ${pct}%`}>
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500 ease-out', prioritized ? 'bg-beacon' : 'bg-primary')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={cn('font-mono text-xs font-medium', tone.cls)}>{pct}%</span>
        </div>
      </div>

      <div className="mt-3">
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
        {cleanSummary(item) && <p className="mt-1 text-sm text-muted-foreground">{cleanSummary(item)}</p>}
        <p className="mt-2 text-xs italic text-muted-foreground/80">
          <span className="font-medium not-italic text-foreground/70">Why it matters: </span>
          {whyItMatters(item)}
        </p>
      </div>

      {item.personId && item.personName && (
        <div className="mt-3 rounded-md border border-beacon/30 bg-beacon/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-beacon">
            <UserCheck className="size-3.5" />
            Prioritized attendee
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

      <div className="mt-3 flex items-center gap-1.5">
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

export function EventsView({ events }: { events: EventItem[] }) {
  const withAttendees = events.filter((e) => e.personId && e.personName);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-beacon/30 bg-beacon/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-beacon">
          <UserCheck className="size-4" />
          Attendee-level prioritization
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Conference prep is not about the venue, it is about who is in the room. We surface the warm contacts already
          matching your ICP so you can plan the conversations that matter before you walk in. Events linked to a person
          you already track are flagged as prioritized attendees below.
        </p>
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
            No ICP-matched attendees linked to these events yet. As people are resolved against event signals, they will
            appear here as prioritized contacts.
          </p>
        )}
      </section>

      <div className="grid gap-3">
        {events.map((e) => (
          <EventCard key={e.id} item={e} />
        ))}
      </div>
    </div>
  );
}
