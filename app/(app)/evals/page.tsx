import { unstable_cache } from 'next/cache';
import { requireOrgId } from '@/lib/auth/session';
import { runClassificationEval, type EvalReport } from '@/lib/evals/report';
import { getCostSeries, getCostByKind } from '@/lib/observability/cost';
import { SIGNAL_TYPE_LABELS, type SignalType } from '@/lib/types';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { CostChart } from '@/components/evals/cost-chart';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Metrics - Signal Scout' };

// The accuracy test re-labels ~30 hand-checked example signals with the real
// model (~45s + token cost). The result is the same for everyone (fixed example
// set + EVAL_ICP), so we run it at most once a day and reuse the cached answer
// instead of re-running it on every page view. Your spend numbers below stay
// live (read fresh from the database on each request, scoped to your org).
const getCachedReport = unstable_cache(runClassificationEval, ['classification-eval'], {
  revalidate: 60 * 60 * 24,
  tags: ['eval-report'],
});

// Never let the accuracy test (slow, network-bound) take the whole page down or
// hold up the live spend numbers. If it errors or hasn't finished, we render the
// page without it rather than 500-ing.
async function safeReport(): Promise<EvalReport | null> {
  try {
    return await getCachedReport();
  } catch {
    return null;
  }
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

export default async function EvalsPage() {
  const orgId = await requireOrgId();
  // Run the three reads independently. The slow accuracy test must not delay the
  // live spend numbers, so it is awaited separately and tolerated if it fails.
  const [series, byKind, report] = await Promise.all([
    getCostSeries(orgId, 14),
    getCostByKind(orgId),
    safeReport(),
  ]);

  const totalCost = byKind.reduce((s, k) => s + k.cost, 0);
  const totalCalls = byKind.reduce((s, k) => s + k.calls, 0);
  const hasSpend = totalCalls > 0;

  return (
    <>
      <PageHeader
        title="Accuracy & spend"
        description="See how well Signal Scout labels buying signals, and how much the AI has cost you so far."
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Labeling accuracy</h2>
            {report ? (
              <span
                className={cn('text-xs font-medium', report.accuracy >= 0.8 ? 'text-primary' : 'text-destructive')}
                title="Share of the example signals the model labeled correctly."
              >
                {(report.accuracy * 100).toFixed(0)}% correct · {report.correct} of {report.total} examples
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Test result not available right now.</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            We hand-labeled {report?.total ?? 30} real example signals, then ask the model to label them again. The closer to
            100%, the more you can trust the categories in your feed.
          </p>

          {report ? (
            <>
              <div className="mt-4 overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Signal type</th>
                      <th className="px-3 py-2 text-right font-medium" title="How many example signals had this type.">
                        Examples
                      </th>
                      <th className="px-3 py-2 text-right font-medium" title="When it picks this type, how often it is right (0 to 1).">
                        Precision
                      </th>
                      <th className="px-3 py-2 text-right font-medium" title="Of the signals that truly are this type, how many it caught (0 to 1).">
                        Recall
                      </th>
                      <th className="px-3 py-2 text-right font-medium" title="Combined precision and recall score (0 to 1).">
                        F1
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.perType.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-center text-xs text-muted-foreground">
                          No example signals to score yet.
                        </td>
                      </tr>
                    ) : (
                      report.perType.map((t, i) => (
                        <tr
                          key={t.type}
                          className="animate-fade-up transition-colors hover:bg-muted/30"
                          style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                        >
                          <td className="px-3 py-1.5">{SIGNAL_TYPE_LABELS[t.type as SignalType] ?? t.type}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{t.support}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{t.precision.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{t.recall.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs">{t.f1.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Strength reads correct {(report.strengthRate * 100).toFixed(0)}% of the time ({report.strengthPass}/
                {report.strengthChecks}). Strength is how strong a buying sign each signal is. Our automated quality check blocks
                a release if accuracy drops below 80%.
              </p>
            </>
          ) : (
            <div className="mt-4 rounded-md border border-dashed p-6 text-center">
              <p className="text-sm font-medium">The accuracy test could not run just now.</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                It runs at most once a day in the background and refreshes on its own. Check back shortly. Your spend numbers
                below are unaffected.
              </p>
            </div>
          )}
        </Card>

        <Card className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md" style={{ animationDelay: '80ms' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">AI spend (last 14 days)</h2>
            <span className="text-xs text-muted-foreground" title="Total across all time for your org.">
              {fmtUsd(totalCost)} · {totalCalls} model calls all time
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            What the AI has cost your team, day by day. Each labeled signal and each research profile uses a little model time.
          </p>
          {hasSpend ? (
            <>
              <div className="mt-3">
                <CostChart data={series} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {byKind.map((k, i) => (
                  <span
                    key={k.kind}
                    className="animate-pop rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70"
                    style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                  >
                    {k.kind}: {k.calls} calls · {fmtUsd(k.cost)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-md border border-dashed p-6 text-center">
              <p className="text-sm font-medium">No AI spend yet.</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Spend shows up here once Signal Scout starts labeling signals and building research profiles for your org. Add
                the kind of customer you sell to on the ICPs page to get the assistant working.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
