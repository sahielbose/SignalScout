import { requireOrgId } from '@/lib/auth/session';
import { PageHeader } from '@/components/app/page-header';
import { ResearchForm } from '@/components/research/research-form';

export const metadata = { title: 'Research - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function ResearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireOrgId();
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Deep research"
        description="Point it at a person - every fact in the dossier carries a clickable source. Uncited claims are dropped; low-confidence results are flagged, never faked."
      />
      <ResearchForm defaults={{ name: sp.name, company: sp.company, domain: sp.domain }} />
    </>
  );
}
