import Link from 'next/link';
import { Building2, ChevronRight, Target, Radar } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { listCompaniesWithCounts } from '@/lib/companies/queries';
import { getOrgIcpIds } from '@/lib/feed/queries';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { relativeTime } from '@/lib/utils';

export const metadata = { title: 'Companies - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const orgId = await requireOrgId();
  // Distinguish "no target customers set up" from "set up, but nothing found yet"
  // so the empty state can tell the user the right next step.
  const [companies, icpIds] = await Promise.all([
    listCompaniesWithCounts(orgId, 100),
    getOrgIcpIds(orgId),
  ]);
  const hasIcps = icpIds.length > 0;

  return (
    <>
      <PageHeader
        title="Companies you are watching"
        description="Every company where we have spotted a public buying sign that matches the kind of customer you sell to. Open one to see its full timeline and who works there."
      />
      <div className="mx-auto max-w-3xl p-6">
        {companies.length === 0 ? (
          <Card className="animate-scale-in p-10 text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {hasIcps ? <Radar className="size-5" /> : <Target className="size-5" />}
            </div>
            {hasIcps ? (
              <>
                <p className="text-sm font-medium">No companies on your radar yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  We are watching public sources for companies that match your target customers. Buying signs show up here as soon as we find them, so check back soon.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Tell us who you sell to first</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Describe the kind of customer you sell to (your ideal customer). Once you do, companies that show public buying signs will start appearing here.
                </p>
                <Link href="/icps" className={buttonVariants({ className: 'mt-4' })}>
                  Set up your target customers
                </Link>
              </>
            )}
          </Card>
        ) : (
          <>
            <p className="mb-3 animate-fade-in text-xs text-muted-foreground">
              Sorted by how many buying signs we have seen. Click a company to open its timeline and team.
            </p>
            <Card className="animate-fade-up divide-y">
              {companies.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/companies/${c.id}`}
                  className="group flex animate-fade-up items-center gap-3 p-3 transition-colors hover:bg-accent/40"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Building2 className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium group-hover:text-primary">{c.name ?? c.domain ?? 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.domain ? `${c.domain} · ` : ''}
                      {c.signals} buying sign{c.signals === 1 ? '' : 's'}
                      {c.lastAt ? ` · last seen ${relativeTime(c.lastAt)}` : ''}
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
