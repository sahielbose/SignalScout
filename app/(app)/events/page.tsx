import { CalendarDays } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { getEvents } from '@/lib/events/queries';
import { PageHeader } from '@/components/app/page-header';
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
        title="Events"
        description="Monitor meetups and conferences, and prioritize the attendees already matching your ICP."
      />
      <div className="mx-auto max-w-3xl p-6">
        {events.length === 0 ? (
          <Card className="animate-scale-in p-10 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-700">
              <CalendarDays className="size-5" />
            </div>
            <p className="mt-3 text-sm font-medium">No events matched yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              When a meetup or conference signal matches one of your active ICPs, it shows up here with its prioritized
              attendees. Add a Conference prep ICP or watch a lu.ma source to start tracking events.
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
