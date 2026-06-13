import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Download, Trash2, Building2, User, ExternalLink, FileSearch, Check } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { getList, getListMembers } from '@/lib/lists/service';
import { removeMemberAction, renameListAction } from '@/lib/lists/actions';
import { getCrmProvider } from '@/lib/providers/crm';
import { hasCrm } from '@/lib/env';
import { CrmPush } from '@/components/lists/crm-push';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

/** Deep-link a person into the research flow with their known details prefilled. */
function researchHref(name: string, company: string | null, domain: string | null): string {
  const q = new URLSearchParams({ name });
  if (company) q.set('company', company);
  if (domain) q.set('domain', domain);
  return `/research?${q.toString()}`;
}

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const list = await getList(orgId, id);
  if (!list) notFound();
  const members = await getListMembers(orgId, id);
  const hasPeople = members.some((m) => m.kind === 'person');
  const peopleCount = members.filter((m) => m.kind === 'person').length;
  const crmConfigured = hasCrm();
  const crmProvider = getCrmProvider().name;

  return (
    <>
      <PageHeader title={list.name} description={`${members.length} member${members.length === 1 ? '' : 's'}`}>
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
          <a href={`/api/lists/${id}/export.csv`} download>
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
        {members.length === 0 ? (
          <Card className="animate-scale-in p-10 text-center text-sm text-muted-foreground">
            Empty list. Use “Add to list” on a signal, or add a researched person.
          </Card>
        ) : (
          <>
            {hasPeople && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSearch className="size-3.5" /> Use Research on any person to open a cited dossier.
              </p>
            )}
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
          </>
        )}
      </div>
    </>
  );
}
