import Link from 'next/link';
import { z } from 'zod';
import { CalendarDays, Target } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { getEvents, getEventTypes, type EventsOptions, type EventSort, type EventWithinDays } from '@/lib/events/queries';
import { getOrgIcpIds } from '@/lib/feed/queries';
import { listSavedViews } from '@/lib/views/service';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EventsView } from '@/components/events/events-view';

export const metadata = { title: 'Events - Signal Scout' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

const SORTS = ['soonest', 'recent', 'strongest'] as const;

/** Parse + validate the URL filters into query options and a clean query string. */
function parseOptions(sp: SP): { options: EventsOptions; params: Record<string, string> } {
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const options: EventsOptions = {};
  const params: Record<string, string> = {};

  const within = Number(get('within'));
  if (within === 7 || within === 30 || within === 90) {
    options.withinDays = within as EventWithinDays;
    params.within = String(within);
  }

  const type = get('type');
  if (type) {
    options.type = type;
    params.type = type;
  }

  const minStrength = Number(get('minStrength'));
  if (Number.isFinite(minStrength) && minStrength > 0 && minStrength <= 1) {
    options.minStrength = minStrength;
    params.minStrength = String(minStrength);
  }

  const sort = z.enum(SORTS).safeParse(get('sort'));
  if (sort.success) {
    options.sort = sort.data as EventSort;
    params.sort = sort.data;
  }

  return { options, params };
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const { options, params } = parseOptions(sp);
  const hasFilters = Object.keys(params).length > 0;

  const [orgIcpIds, events, eventTypes, savedViews] = await Promise.all([
    getOrgIcpIds(orgId),
    getEvents(orgId, options),
    getEventTypes(orgId),
    listSavedViews(orgId, 'events'),
  ]);

  // No customer profile set up yet → guide the user to create one. We only show
  // this when nothing is filtered, so an empty filtered result keeps the controls.
  if (orgIcpIds.length === 0 && !hasFilters) {
    return (
      <>
        <PageHeader
          title="Events worth showing up to"
          description="See meetups and conferences tied to the kind of customer you sell to, and the people going who already look like a fit, so you can line up the right conversations before you arrive."
        />
        <div className="mx-auto max-w-3xl p-6">
          <Card className="animate-scale-in p-10 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-700">
              <CalendarDays className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium">No matching events yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Once we spot a meetup or conference that fits the customers you sell to, it lands here, with the people
              going who already match flagged for you. To start, tell us who you sell to by adding a Conference prep
              profile.
            </p>
            <div className="mt-5">
              <Button asChild>
                <Link href="/icps">
                  <Target className="size-4" /> Add a Conference prep ICP
                </Link>
              </Button>
            </div>
            <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground/80">
              An ICP is just a short note describing the kind of customer you sell to. We use it to pick out events and
              attendees that matter to you.
            </p>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Events worth showing up to"
        description="See meetups and conferences tied to the kind of customer you sell to, and the people going who already look like a fit, so you can line up the right conversations before you arrive."
      />
      <div className="mx-auto max-w-3xl p-6">
        <div className="animate-fade-up">
          <EventsView events={events} eventTypes={eventTypes} savedViews={savedViews} hasFilters={hasFilters} />
        </div>
      </div>
    </>
  );
}
