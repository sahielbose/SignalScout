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
        title="Research a person"
        description="Type someone's name and we read their public footprint to build a research profile where every fact links to the source it came from."
      />
      <div className="animate-fade-up">
        <ResearchForm defaults={{ name: sp.name, company: sp.company, domain: sp.domain }} />
      </div>
    </>
  );
}
