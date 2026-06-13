'use server';

import { requireOrgId } from '@/lib/auth/session';
import { runClassificationEval, type EvalReport } from '@/lib/evals/report';

/**
 * Run the labeling-accuracy check on demand. It re-labels about 30 hand-checked
 * example signals with the real model (about a minute, a little token cost), so
 * it is never run on page load; the user triggers it from a button instead.
 */
export async function runAccuracyCheckAction(): Promise<{ ok: boolean; report?: EvalReport; error?: string }> {
  try {
    await requireOrgId();
    const report = await runClassificationEval();
    return { ok: true, report };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
