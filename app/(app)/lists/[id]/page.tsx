import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Download,
  Trash2,
  Building2,
  User,
  ExternalLink,
  FileSearch,
  Check,
  Users,
  ArrowDownWideNarrow,
  Columns3,
  Bookmark,
  Star,
} from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import {
  getList,
  getListMembers,
  parseMemberKind,
  parseMemberSort,
  parseExportColumns,
  LIST_EXPORT_COLUMNS,
  type MemberKindFilter,
  type MemberSort,
} from '@/lib/lists/service';
import { removeMemberAction, renameListAction } from '@/lib/lists/actions';
import { saveViewAction, deleteViewAction } from '@/lib/views/actions';
import { listSavedViews } from '@/lib/views/service';
import { getCrmProvider } from '@/lib/providers/crm';
import { hasCrm } from '@/lib/env';
import { CrmPush } from '@/components/lists/crm-push';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SURFACE = 'lists';
type SP = Record<string, string | string[] | undefined>;

const KIND_OPTIONS: { value: MemberKindFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'person', label: 'People only' },
  { value: 'company', label: 'Companies only' },
];

const SORT_OPTIONS: { value: MemberSort; label: string }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'name', label: 'Name (A to Z)' },
];

/** Deep-link a person into the research flow with their known details prefilled. */
function researchHref(name: string, company: string | null, domain: string | null): string {
  const q = new URLSearchParams({ name });
  if (company) q.set('company', company);
  if (domain) q.set('domain', domain);
  return `/research?${q.toString()}`;
}

/** Keep the filter + sort in the URL so links are shareable and bookmarkable. */
function viewParams(kind: MemberKindFilter, sort: MemberSort): URLSearchParams {
  const p = new URLSearchParams();
  if (kind !== 'all') p.set('kind', kind);
  if (sort !== 'recent') p.set('sort', sort);
  return p;
}

/** Save the current filter + sort of this list as a named, re-usable view. */
async function saveListViewAction(form: FormData) {
  'use server';
  const name = String(form.get('name') ?? '').trim();
  const params: Record<string, string> = {};
  const kind = String(form.get('kind') ?? '');
  const sort = String(form.get('sort') ?? '');
  // Scope the saved view to this specific list so it re-applies on the right page.
  const listId = String(form.get('listId') ?? '');
  if (listId) params.list = listId;
  if (kind && kind !== 'all') params.kind = kind;
  if (sort && sort !== 'recent') params.sort = sort;
  if (name) await saveViewAction(SURFACE, name, params);
}

/** Remove a saved view from the workspace. */
async function deleteListViewAction(form: FormData) {
  'use server';
  const viewId = String(form.get('viewId') ?? '');
  if (viewId) await deleteViewAction(SURFACE, viewId);
}

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const sp = await searchParams;

  const kind = parseMemberKind(typeof sp.kind === 'string' ? sp.kind : undefined);
  const sort = parseMemberSort(typeof sp.sort === 'string' ? sp.sort : undefined);
  const selectedCols = parseExportColumns(typeof sp.cols === 'string' ? sp.cols : undefined);

  // All three queries are independently org-scoped and fail closed, so run them
  // in parallel instead of waterfalling.
  const [list, members, savedViews] = await Promise.all([
    getList(orgId, id),
    getListMembers(orgId, id, { kind, sort }),
    listSavedViews(orgId, SURFACE),
  ]);
  if (!list) notFound();

  // Counts for the filter chips come from a quick unfiltered lookup so the
  // labels stay honest no matter which filter is active.
  const allMembers = kind === 'all' ? members : await getListMembers(orgId, id, { sort });
  const totalCount = allMembers.length;
  const peopleCount = allMembers.filter((m) => m.kind === 'person').length;
  const companyCount = totalCount - peopleCount;
  const hasPeople = members.some((m) => m.kind === 'person');

  const crmConfigured = hasCrm();
  const crmProvider = getCrmProvider().name;

  // Carry the current filter + sort + chosen columns onto the export link so the
  // downloaded file matches exactly what is on screen.
  const exportQuery = viewParams(kind, sort);
  for (const c of selectedCols) exportQuery.append('cols', c);
  const exportHref = `/api/lists/${id}/export.csv${exportQuery.toString() ? `?${exportQuery.toString()}` : ''}`;

  // Build a chip href that flips one param while keeping the rest of the view.
  const chipHref = (next: { kind?: MemberKindFilter; sort?: MemberSort }) => {
    const p = viewParams(next.kind ?? kind, next.sort ?? sort);
    // Preserve the user's column choice across filter/sort changes.
    if (typeof sp.cols === 'string') p.set('cols', sp.cols);
    const qs = p.toString();
    return qs ? `/lists/${id}?${qs}` : `/lists/${id}`;
  };

  // Apply a saved view: rebuild the URL from its stored params.
  const savedViewHref = (params: Record<string, string>) => {
    const p = new URLSearchParams();
    if (params.kind) p.set('kind', params.kind);
    if (params.sort) p.set('sort', params.sort);
    const qs = p.toString();
    return qs ? `/lists/${id}?${qs}` : `/lists/${id}`;
  };

  const countFor = (k: MemberKindFilter) =>
    k === 'person' ? peopleCount : k === 'company' ? companyCount : totalCount;

  return (
    <>
      <PageHeader
        backHref="/lists"
        backLabel="All lists"
        title={list.name}
        description={
          totalCount === 0
            ? 'A saved group of people and companies. Export it to a spreadsheet or send it to your CRM once you add some.'
            : `${totalCount} saved ${totalCount === 1 ? 'contact' : 'contacts'}. Export this group to a spreadsheet, send it to your CRM, or research anyone on it.`
        }
      >
        <form action={renameListAction} className="flex items-center gap-1.5">
          <input type="hidden" name="id" value={id} />
          <Input
            name="name"
            defaultValue={list.name}
            required
            aria-label="List name"
            className="h-8 w-44 text-sm"
          />
          <Button type="submit" variant="outline" size="sm" title="Rename list">
            <Check className="size-4" /> Rename
          </Button>
        </form>
        <Button asChild variant="outline" size="sm">
          <a href={exportHref} download>
            <Download className="size-4" /> Export CSV
          </a>
        </Button>
        <CrmPush
          listId={id}
          listName={list.name}
          peopleCount={peopleCount}
          configured={crmConfigured}
          provider={crmProvider}
        />
      </PageHeader>

      <div className="mx-auto max-w-4xl space-y-3 p-6">
        {totalCount === 0 ? (
          <Card className="flex animate-scale-in flex-col items-center gap-3 p-10 text-center">
            <FileSearch className="size-8 text-primary" />
            <p className="text-sm font-medium">This list is empty</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add people and companies here from the feed or from a research profile using the "Add to list"
              button. Once it has some, you can export the whole group to a spreadsheet or send it to your CRM.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/feed">Browse the feed</Link>
            </Button>
          </Card>
        ) : (
          <>
            {/* Show / sort controls */}
            <Card className="animate-fade-up space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                  <Users className="size-4" /> Show
                </span>
                {KIND_OPTIONS.map((o) => {
                  const active = kind === o.value;
                  return (
                    <Link
                      key={o.value}
                      href={chipHref({ kind: o.value })}
                      aria-pressed={active}
                      className={cn(
                        'rounded-md border px-2.5 py-1 font-medium transition-colors duration-200',
                        active
                          ? 'border-primary/40 bg-primary/12 text-primary'
                          : 'border-input text-muted-foreground hover:border-ring/60 hover:text-foreground',
                      )}
                    >
                      {o.label}{' '}
                      <span className={cn('tabular-nums', active ? 'opacity-80' : 'opacity-60')}>
                        {countFor(o.value)}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                  <ArrowDownWideNarrow className="size-4" /> Sort by
                </span>
                {SORT_OPTIONS.map((o) => {
                  const active = sort === o.value;
                  return (
                    <Link
                      key={o.value}
                      href={chipHref({ sort: o.value })}
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

              {/* Saved views */}
              <div className="space-y-2 border-t pt-3 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                  <Star className="size-4" /> Saved views
                </span>
                <p className="text-muted-foreground">
                  Save this filter and sort setup under a name so you (and your teammates) can re-apply it in one
                  click.
                </p>
                {savedViews.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {savedViews
                      // Only show views saved for this specific list.
                      .filter((v) => !v.params.list || v.params.list === id)
                      .map((v) => (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1"
                        >
                          <Link
                            href={savedViewHref(v.params)}
                            className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
                          >
                            <Bookmark className="size-3" /> {v.name}
                          </Link>
                          <form action={deleteListViewAction} className="contents">
                            <input type="hidden" name="viewId" value={v.id} />
                            <button
                              type="submit"
                              title="Delete this saved view"
                              className="text-muted-foreground transition-colors hover:text-destructive"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </form>
                        </span>
                      ))}
                  </div>
                )}
                <form action={saveListViewAction} className="flex flex-wrap items-center gap-1.5">
                  <input type="hidden" name="listId" value={id} />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="sort" value={sort} />
                  <Input
                    name="name"
                    required
                    aria-label="Name for this saved view"
                    placeholder="Name this view (e.g. People, A to Z)"
                    className="h-8 w-56 text-xs"
                  />
                  <Button type="submit" variant="outline" size="sm">
                    <Bookmark className="size-3.5" /> Save current view
                  </Button>
                </form>
              </div>
            </Card>

            {/* CSV export column picker */}
            <Card className="animate-fade-up space-y-2 p-4 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                <Columns3 className="size-4" /> Columns to include in the CSV export
              </span>
              <p className="text-muted-foreground">
                Tick the columns you want in the downloaded spreadsheet, then press Download. The file also follows
                the Show and Sort choices above.
              </p>
              <form method="get" action={exportHref.split('?')[0]} className="space-y-2">
                {/* Carry the active filter + sort into the download. */}
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="sort" value={sort} />
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {LIST_EXPORT_COLUMNS.map((c) => (
                    <label key={c.key} className="inline-flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        name="cols"
                        value={c.key}
                        defaultChecked={selectedCols.includes(c.key)}
                        className="size-3.5 accent-primary"
                      />
                      <span className="font-medium text-foreground">{c.label}</span>
                    </label>
                  ))}
                </div>
                <Button type="submit" variant="outline" size="sm">
                  <Download className="size-3.5" /> Download with these columns
                </Button>
              </form>
            </Card>

            <p className="text-xs text-muted-foreground">
              Click anyone to open their profile. "Research" builds a research profile on a person backed by public
              sources you can check. Use "Export CSV" or "Push to CRM" above to send this whole group onward.
            </p>
            {hasPeople && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSearch className="size-3.5" /> Research opens a profile with sources you can verify.
              </p>
            )}

            {members.length === 0 ? (
              <Card className="animate-fade-up p-6 text-center text-sm text-muted-foreground">
                Nothing matches this filter. Try "Everyone" above.
              </Card>
            ) : (
              <Card className="animate-fade-up divide-y">
                {members.map((m, i) => (
                  <div
                    key={m.memberId}
                    className="flex animate-fade-up items-center gap-3 p-3 transition-colors hover:bg-accent/40"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      {m.kind === 'person' ? <User className="size-4" /> : <Building2 className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {m.kind === 'person' ? (
                          <Link href={`/people/${m.entityId}`} className="truncate font-medium hover:text-primary hover:underline">
                            {m.name}
                          </Link>
                        ) : (
                          <Link href={`/companies/${m.entityId}`} className="truncate font-medium hover:text-primary hover:underline">
                            {m.name}
                          </Link>
                        )}
                        <Badge variant="muted">{m.kind}</Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[m.title, m.kind === 'person' ? m.companyName : m.domain, m.location].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {m.kind === 'person' && (
                      <Button asChild size="sm" variant="ghost" title="Research this person">
                        <Link href={researchHref(m.name, m.companyName, m.domain)}>
                          <FileSearch className="size-3.5" /> Research
                        </Link>
                      </Button>
                    )}
                    {m.linkedinUrl && (
                      <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                    <form action={removeMemberAction}>
                      <input type="hidden" name="listId" value={id} />
                      <input type="hidden" name="memberId" value={m.memberId} />
                      <Button variant="ghost" size="icon" type="submit" title="Remove">
                        <Trash2 className="size-4" />
                      </Button>
                    </form>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
