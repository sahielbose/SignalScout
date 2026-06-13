import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { listCompaniesWithCounts } from '@/lib/companies/queries';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { relativeTime } from '@/lib/utils';

export const metadata = { title: 'Companies - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  await requireOrgId();
  const companies = (await listCompaniesWithCounts(100)).filter((c) => c.signals > 0);

  return (
    <>
      <PageHeader title="Companies" description="Every company with tracked public signals - open one for its timeline and org view." />
      <div className="mx-auto max-w-3xl p-6">
        {companies.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">No companies with signals yet. Run the worker to ingest sources.</Card>
        ) : (
          <Card className="divide-y">
            {companies.map((c) => (
              <Link key={c.id} href={`/companies/${c.id}`} className="group flex items-center gap-3 p-3 hover:bg-accent/40">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium group-hover:text-primary">{c.name ?? c.domain ?? 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.domain ? `${c.domain} · ` : ''}
                    {c.signals} signal{c.signals === 1 ? '' : 's'}
                    {c.lastAt ? ` · last ${relativeTime(c.lastAt)}` : ''}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
