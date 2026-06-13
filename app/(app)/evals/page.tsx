import { requireOrgId } from '@/lib/auth/session';
import { getCostSeries, getCostByKind, getCostByKindSeries, COST_RANGES, type CostRange } from '@/lib/observability/cost';
import { listSavedViews } from '@/lib/views/service';
import { SIGNAL_TYPE_LABELS } from '@/lib/types';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { CostChart } from '@/components/evals/cost-chart';
import { AccuracyCheck } from '@/components/evals/accuracy-check';

export const metadata = { title: 'Accuracy and spend - SignalScout' };
// Reads live spend per request and the URL filters, so render on demand. The
// slow accuracy check is NOT run here; it runs on demand from a button.
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

/** Read the date-range filter from the URL, defaulting to 14 days. */
function parseRange(sp: SP): CostRange {
  const raw = Number(typeof sp.range === 'string' ? sp.range : '');
  return (COST_RANGES as readonly number[]).includes(raw) ? (raw as CostRange) : 14;
}

export default async function EvalsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const orgId = await requireOrgId();
  const sp = await searchParams;

  const range = parseRange(sp);
  const chartMode: 'day' | 'kind' = (typeof sp.chart === 'string' ? sp.chart : '') === 'kind' ? 'kind' : 'day';
  const sigType = typeof sp.sigType === 'string' ? sp.sigType : '';

  // Only fast, live spend reads run on render. Everything here is org-scoped.
  const [series, kindSeries, byKindRange, byKindAll, savedViews] = await Promise.all([
    getCostSeries(orgId, range),
    getCostByKindSeries(orgId, range),
    getCostByKind(orgId, range),
    getCostByKind(orgId),
    listSavedViews(orgId, 'metrics'),
  ]);

  const totalCostAll = byKindAll.reduce((s, k) => s + k.cost, 0);
  const totalCallsAll = byKindAll.reduce((s, k) => s + k.calls, 0);
  const hasSpend = totalCallsAll > 0;

  return (
    <>
      <PageHeader
        title="Accuracy and spend"
        description="See how well SignalScout labels buying signals, and how much the AI has cost you so far."
      />
      <div className="mx-auto max-w-4xl space-y-5 p-6">
        <Card className="animate-fade-up p-5">
          <p className="text-sm text-muted-foreground">
            Two health checks for the assistant. <strong className="font-medium text-foreground">Labeling accuracy</strong> is a
            graded test that scores how often it tags a signal (a public moment that suggests a company may be ready to buy)
            with the right category. <strong className="font-medium text-foreground">AI spend</strong> is what the models have
            cost your team. Higher accuracy means more trustworthy signals; watch spend so there are no surprises.
          </p>
        </Card>

        <Card className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md" style={{ animationDelay: '40ms' }}>
          <AccuracyCheck />
        </Card>

        <Card className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md" style={{ animationDelay: '80ms' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">AI spend</h2>
            <span className="text-xs text-muted-foreground" title="Total across all time for your org.">
              {fmtUsd(totalCostAll)} · {totalCallsAll} model call{totalCallsAll === 1 ? '' : 's'} all time
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            What the AI has cost your team, day by day. Each labeled signal and each research profile uses a little model time.
            Use the controls to change the date range or split spend by the kind of call.
          </p>
          {hasSpend ? (
            <div className="mt-3">
              <CostChart
                series={series}
                kindSeries={kindSeries.rows}
                kinds={kindSeries.kinds}
                byKind={byKindRange}
                range={range}
                chartMode={chartMode}
                sigType={sigType}
                signalTypes={Object.keys(SIGNAL_TYPE_LABELS)}
                signalTypeLabels={SIGNAL_TYPE_LABELS}
                savedViews={savedViews}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed p-6 text-center">
              <p className="text-sm font-medium">No AI spend yet.</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Spend shows up here once SignalScout starts labeling signals and building research profiles for your org. Add
                the kind of customer you sell to on the ICPs page to get the assistant working.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
