import Link from 'next/link';
import { ListChecks, Plus, Trash2, ChevronRight } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { listLists } from '@/lib/lists/service';
import { createListAction, deleteListAction } from '@/lib/lists/actions';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { relativeTime } from '@/lib/utils';

export const metadata = { title: 'Lists - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function ListsPage() {
  const orgId = await requireOrgId();
  const rows = await listLists(orgId);

  return (
    <>
      <PageHeader
        title="Lists"
        description="A list is a saved group of people and companies you build from the feed and research, so you can come back to them, export them to a spreadsheet, or send them to your CRM."
      />
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <Card className="animate-fade-up space-y-3 p-4">
          <form action={createListAction} className="flex gap-2">
            <Input name="name" placeholder="Name your list (e.g. Q3 fintech targets)" required />
            <Button type="submit">
              <Plus /> Create list
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Name a list here, then add people and companies to it from the feed or from a research profile using
            the "Add to list" button. Open any list to export it or send it onward.
          </p>
        </Card>

        {rows.length === 0 ? (
          <Card className="flex animate-scale-in flex-col items-center gap-3 p-12 text-center">
            <ListChecks className="size-8 text-primary" />
            <p className="text-sm font-medium">No lists yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Lists are how you save the prospects worth following up on. Create your first one in the box above,
              then use the "Add to list" button on any signal in the feed to drop people and companies into it.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/feed">Go to the feed</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((l, i) => (
              <Card
                key={l.id}
                className="flex animate-fade-up items-center justify-between p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Link href={`/lists/${l.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <ListChecks className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium group-hover:text-primary">
                      {l.name} <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.members} member{l.members === 1 ? '' : 's'} · created {relativeTime(l.createdAt)}
                    </div>
                  </div>
                </Link>
                <form action={deleteListAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <Button variant="ghost" size="icon" type="submit" title="Delete list">
                    <Trash2 className="size-4" />
                  </Button>
                </form>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
