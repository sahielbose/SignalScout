'use client';

import { useState, useTransition } from 'react';
import { Loader2, Gauge, RefreshCw } from 'lucide-react';
import type { EvalReport } from '@/lib/evals/report';
import { runAccuracyCheckAction } from '@/app/(app)/evals/actions';
import { SIGNAL_TYPE_LABELS, type SignalType } from '@/lib/types';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The labeling-accuracy check, run on demand. The page loads instantly; the
 * user clicks to run the real model over the example set (about a minute).
 */
export function AccuracyCheck() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [sigType, setSigType] = useState('');
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const r = await runAccuracyCheckAction();
      if (r.ok && r.report) {
        setReport(r.report);
        toast('Accuracy check complete', 'success');
      } else {
        toast(r.error ?? 'Could not run the accuracy check', 'error');
      }
    });

  const rows = report ? (sigType ? report.perType.filter((t) => t.type === sigType) : report.perType) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Labeling accuracy</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A graded test: we hand-labeled about 30 real example signals, then ask the model to label them again. The closer
            to 100 percent, the more you can trust the categories in your feed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <span
              className={cn('text-xs font-medium', report.accuracy >= 0.8 ? 'text-primary' : 'text-destructive')}
              title="Share of the example signals the model labeled correctly."
            >
              {(report.accuracy * 100).toFixed(0)}% correct, {report.correct} of {report.total}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={run} disabled={pending} className="shrink-0">
            {pending ? <Loader2 className="animate-spin" /> : report ? <RefreshCw /> : <Gauge />}
            {pending ? 'Running, about a minute' : report ? 'Run again' : 'Run accuracy check'}
          </Button>
        </div>
      </div>

      {!report && !pending && (
        <div className="mt-4 rounded-md border border-dashed p-6 text-center">
          <p className="text-sm font-medium">Run the check to see how accurately signals are labeled.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            It takes about a minute and uses a little AI time, so it runs only when you ask. Your spend numbers below load
            instantly and are unaffected.
          </p>
        </div>
      )}

      {report && (
        <div className="mt-4 animate-fade-up">
          {report.perType.length > 1 && (
            <div className="mb-3 flex items-center gap-2">
              <label htmlFor="sigType" className="text-xs text-muted-foreground">
                Show
              </label>
              <select
                id="sigType"
                value={sigType}
                onChange={(e) => setSigType(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              >
                <option value="">All signal types</option>
                {report.perType.map((t) => (
                  <option key={t.type} value={t.type}>
                    {SIGNAL_TYPE_LABELS[t.type as SignalType] ?? t.type}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Signal type</th>
                  <th className="px-3 py-2 text-right font-medium" title="How many example signals had this type.">
                    Examples
                  </th>
                  <th className="px-3 py-2 text-right font-medium" title="When it picks this type, how often it is right.">
                    Precision
                  </th>
                  <th className="px-3 py-2 text-right font-medium" title="Of the signals that truly are this type, how many it caught.">
                    Recall
                  </th>
                  <th className="px-3 py-2 text-right font-medium" title="Combined precision and recall score.">
                    F1
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((t) => (
                  <tr key={t.type} className="transition-colors hover:bg-muted/30">
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
            Strength reads correct {(report.strengthRate * 100).toFixed(0)} percent of the time ({report.strengthPass} of{' '}
            {report.strengthChecks}). Our automated quality check blocks a release if accuracy drops below 80 percent.
          </p>
        </div>
      )}
    </div>
  );
}
