import Link from 'next/link';
import { Target, Radar } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import {
  listCompaniesWithCounts,
  getCompanyFacets,
  COMPANY_SORTS,
  type CompaniesListOptions,
  type CompanySort,
} from '@/lib/companies/queries';
import { getOrgIcpIds } from '@/lib/feed/queries';
import { listSavedViews } from '@/lib/views/service';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { CompaniesToolbar, CompaniesList } from '@/components/companies/org-tree';

export const metadata = { title: 'Companies - Signal Scout' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

/** Parse the URL params into org-scoped list options (every value validated). */
function parseOptions(sp: SP): CompaniesListOptions {
  const get = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const options: CompaniesListOptions = {};

  const q = get('q')?.trim();
  if (q) options.search = q.slice(0, 80);

  const type = get('type');
  if (type) options.type = type;

  const min = Number(get('minSignals'));
  if (Number.isFinite(min) && min > 1) options.minSignals = Math.floor(min);

  const sort = get('sort');
  if (sort && (COMPANY_SORTS as readonly string[]).includes(sort)) {
    options.sort = sort as CompanySort;
  }

  return options;
}

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const options = parseOptions(sp);
  const filtersActive = Boolean(options.search || options.type || options.minSignals);

  // Distinguish "no target customers set up" from "set up, but nothing found yet"
  // so the empty state can tell the user the right next step.
  const [companies, icpIds, facets, savedViews] = await Promise.all([
    listCompaniesWithCounts(orgId, options),
    getOrgIcpIds(orgId),
    getCompanyFacets(orgId),
    listSavedViews(orgId, 'companies'),
  ]);
  const hasIcps = icpIds.length > 0;

  // Only the truly-empty (no filters, nothing found) case gets the onboarding
  // empty state. When filters are active but match nothing, the list component
  // shows its own "no matches" message so the toolbar stays available.
  const trulyEmpty = companies.length === 0 && !filtersActive;

  return (
    <>
      <PageHeader
        title="Companies you are watching"
        description="Every company where we have spotted a public buying sign that matches the kind of customer you sell to. Open one to see its full timeline and who works there."
      />
      <div className="mx-auto max-w-3xl p-6">
        {trulyEmpty ? (
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
          <div className="animate-fade-in space-y-4">
            <CompaniesToolbar types={facets.types} savedViews={savedViews} />
            <CompaniesList companies={companies} />
          </div>
        )}
      </div>
    </>
  );
}
