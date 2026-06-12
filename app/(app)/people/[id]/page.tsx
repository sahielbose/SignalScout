import { notFound } from 'next/navigation';
import { requireOrgId } from '@/lib/auth/session';
import { getPersonWithDossier } from '@/lib/research/people-queries';
import { PageHeader } from '@/components/app/page-header';
import { DossierPanel } from '@/components/research/dossier-panel';
import { RefreshDossier } from '@/components/research/refresh-dossier';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const ctx = await getPersonWithDossier(orgId, id);
  if (!ctx) notFound();

  const { person, companyName, dossier } = ctx;

  return (
    <>
      <PageHeader
        title={person.fullName}
        description={[person.title, companyName, person.location].filter(Boolean).join(' · ') || undefined}
      >
        <RefreshDossier personId={person.id} name={person.fullName} company={companyName} hasDossier={!!dossier} />
      </PageHeader>

      <div className="mx-auto max-w-3xl p-6">
        {dossier ? (
          <Card className="p-5">
            <DossierPanel dossier={dossier} meta={ctx.meta ? { model: ctx.meta.model ?? undefined, cached: true } : undefined} />
          </Card>
        ) : (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No dossier yet for {person.fullName}. Run deep research to build a cited profile from public sources.
            </p>
            <RefreshDossier personId={person.id} name={person.fullName} company={companyName} hasDossier={false} />
          </Card>
        )}
      </div>
    </>
  );
}
