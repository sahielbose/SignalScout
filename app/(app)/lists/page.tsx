import Link from 'next/link';
import { ListChecks, Plus, ChevronRight, ArrowDownWideNarrow } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { listLists, parseListSort, type ListSort } from '@/lib/lists/service';
import { createListAction } from '@/lib/lists/actions';
import { PageHeader } from '@/components/app/page-header';
import { DeleteListButton } from '@/components/lists/delete-list-button';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { relativeTime, cn } from '@/lib/utils';

export const metadata = { title: 'Lists - Signal Scout' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

const SORT_OPTIONS: { value: ListSort; label: string }[] = [
  { value: 'recent', label: 'Recently created' },
  { value: 'name', label: 'Name (A to Z)' },
];

export default async function ListsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const sort = parseListSort(typeof sp.sort === 'string' ? sp.sort : undefined);
  const rows = await listLists(orgId, sort);

  const sortHref = (value: ListSort) => (value === 'recent' ? '/lists' : `/lists?sort=${value}`);

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

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
              <ArrowDownWideNarrow className="size-4" /> Sort lists by
            </span>
            {SORT_OPTIONS.map((o) => {
              const active = sort === o.value;
              return (
                <Link
                  key={o.value}
                  href={sortHref(o.value)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-md border px-2.5 py-1 font-medium transition-colors duration-200',
                    active
                      ? 'border-primary/40 bg-primary/12 text-primary'
                      : 'border-input text-muted-foreground hover:border-ring/60 hover:text-foreground',
                  )}
                >
                  {o.label}
                </Link>
              );
            })}
          </div>
        )}

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
                <DeleteListButton id={l.id} name={l.name} members={l.members} />
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
