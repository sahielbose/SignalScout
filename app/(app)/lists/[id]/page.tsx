import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Download, Trash2, Building2, User, ExternalLink } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { getList, getListMembers } from '@/lib/lists/service';
import { removeMemberAction } from '@/lib/lists/actions';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const list = await getList(orgId, id);
  if (!list) notFound();
  const members = await getListMembers(orgId, id);

  return (
    <>
      <PageHeader title={list.name} description={`${members.length} member${members.length === 1 ? '' : 's'}`}>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/lists/${id}/export.csv`} download>
            <Download className="size-4" /> Export CSV
          </a>
        </Button>
      </PageHeader>

      <div className="mx-auto max-w-4xl p-6">
        {members.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Empty list. Use “Add to list” on a signal, or add a researched person.
          </Card>
        ) : (
          <Card className="divide-y">
            {members.map((m) => (
              <div key={m.memberId} className="flex items-center gap-3 p-3">
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
      </div>
    </>
  );
}
