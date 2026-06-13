import Link from 'next/link';
import { CalendarDays, Target } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { getEvents } from '@/lib/events/queries';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EventsView } from '@/components/events/events-view';

export const metadata = { title: 'Events - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const orgId = await requireOrgId();
  const events = await getEvents(orgId);

  return (
    <>
      <PageHeader
        title="Events worth showing up to"
        description="See meetups and conferences tied to the kind of customer you sell to, and the people going who already look like a fit, so you can line up the right conversations before you arrive."
      />
      <div className="mx-auto max-w-3xl p-6">
        {events.length === 0 ? (
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
        ) : (
          <div className="animate-fade-up">
            <EventsView events={events} />
          </div>
        )}
      </div>
    </>
  );
}
