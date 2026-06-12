import { requireOrgId } from '@/lib/auth/session';
import { runClassificationEval } from '@/lib/evals/report';
import { getCostSeries, getCostByKind } from '@/lib/observability/cost';
import { SIGNAL_TYPE_LABELS, type SignalType } from '@/lib/types';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { CostChart } from '@/components/evals/cost-chart';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Metrics — Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function EvalsPage() {
  const orgId = await requireOrgId();
  const [report, series, byKind] = await Promise.all([runClassificationEval(), getCostSeries(orgId, 14), getCostByKind(orgId)]);
  const totalCost = byKind.reduce((s, k) => s + k.cost, 0);
  const totalCalls = byKind.reduce((s, k) => s + k.calls, 0);

  return (
    <>
      <PageHeader title="Metrics" description="Classification eval scores and model spend — the trust + cost layer at a glance." />
      <div className="mx-auto max-w-4xl space-y-5 p-6">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Classification eval</h2>
            <span className={cn('text-xs font-medium', report.accuracy >= 0.8 ? 'text-primary' : 'text-destructive')}>
              {(report.accuracy * 100).toFixed(0)}% accuracy · {report.correct}/{report.total} on golden set
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Support</th>
                  <th className="px-3 py-2 text-right font-medium">Precision</th>
                  <th className="px-3 py-2 text-right font-medium">Recall</th>
                  <th className="px-3 py-2 text-right font-medium">F1</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.perType.map((t) => (
                  <tr key={t.type}>
                    <td className="px-3 py-1.5">{SIGNAL_TYPE_LABELS[t.type as SignalType] ?? t.type}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">{t.support}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">{t.precision.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">{t.recall.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">{t.f1.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Strength gate {(report.strengthRate * 100).toFixed(0)}% ({report.strengthPass}/{report.strengthChecks}). The CI gate{' '}
            (<code>pnpm eval</code>) fails the build below 80% accuracy or 0.6 per-type recall.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Model spend (14 days)</h2>
            <span className="text-xs text-muted-foreground">${totalCost.toFixed(4)} · {totalCalls} calls all-time</span>
          </div>
          <div className="mt-3">
            <CostChart data={series} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {byKind.map((k) => (
              <span key={k.kind} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {k.kind}: {k.calls} calls · ${k.cost.toFixed(4)}
              </span>
            ))}
            {byKind.length === 0 && <span className="text-xs text-muted-foreground">No model calls yet.</span>}
          </div>
        </Card>
      </div>
    </>
  );
}
