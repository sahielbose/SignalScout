import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { RawItemSchema, SignalTypeSchema, SIGNAL_TYPES, type IcpDefinition } from '@/lib/types';
import { classify } from '@/lib/classify/classifier';
import { setLlmLogging } from '@/lib/providers/llm';

const GoldenItemSchema = z.object({
  input: RawItemSchema,
  expected: z.object({ type: SignalTypeSchema, min_strength: z.number().min(0).max(1).optional() }),
  note: z.string().optional(),
});
export type GoldenItem = z.infer<typeof GoldenItemSchema>;

export const EVAL_ICP: { id: string; name: string; definition: IcpDefinition } = {
  id: 'eval-icp',
  name: 'Eval — broad B2B',
  definition: {
    industries: ['fintech', 'developer tools', 'saas', 'ai', 'payments', 'infrastructure', 'data'],
    titles: ['account executive', 'sales', 'engineer', 'product', 'gtm', 'revenue'],
    keywords: ['api', 'payments', 'developer', 'platform', 'data', 'sdk', 'sales', 'revenue', 'cloud', 'security', 'launch'],
    geos: ['United States', 'EMEA', 'Remote'],
    signalTypes: [],
    notify: { email: false, slack: false },
    notifyThreshold: 0.7,
  },
};

export interface PerType {
  type: string;
  support: number;
  precision: number;
  recall: number;
  f1: number;
}
export interface EvalReport {
  total: number;
  correct: number;
  accuracy: number;
  strengthChecks: number;
  strengthPass: number;
  strengthRate: number;
  perType: PerType[];
  mistakes: string[];
}

export function loadGolden(dir = join(process.cwd(), 'evals', 'golden', 'classification')): GoldenItem[] {
  const items: GoldenItem[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const entry of Array.isArray(raw) ? raw : [raw]) {
      items.push(GoldenItemSchema.parse(entry));
    }
  }
  return items;
}

export async function runClassificationEval(): Promise<EvalReport> {
  setLlmLogging(false);
  const golden = loadGolden();
  const tp: Record<string, number> = {};
  const fp: Record<string, number> = {};
  const fn: Record<string, number> = {};
  const support: Record<string, number> = {};
  for (const t of SIGNAL_TYPES) tp[t] = fp[t] = fn[t] = support[t] = 0;

  let correct = 0;
  let strengthChecks = 0;
  let strengthPass = 0;
  const mistakes: string[] = [];

  for (const item of golden) {
    const r = await classify({
      source: item.input.source,
      text: item.input.text,
      title: item.input.title,
      hint: item.input.hintType,
      icps: [EVAL_ICP],
    });
    const expected = item.expected.type;
    support[expected]!++;
    if (r.type === expected) {
      correct++;
      tp[expected]!++;
    } else {
      fp[r.type]!++;
      fn[expected]!++;
      mistakes.push(`"${(item.input.title ?? item.input.text).slice(0, 50)}" expected=${expected} got=${r.type}`);
    }
    if (item.expected.min_strength != null) {
      strengthChecks++;
      if (r.strength >= item.expected.min_strength) strengthPass++;
    }
  }

  const perType: PerType[] = [];
  for (const t of SIGNAL_TYPES) {
    if (support[t] === 0 && tp[t] === 0 && fp[t] === 0) continue;
    const prec = tp[t]! + fp[t]! ? tp[t]! / (tp[t]! + fp[t]!) : 1;
    const rec = tp[t]! + fn[t]! ? tp[t]! / (tp[t]! + fn[t]!) : 1;
    const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
    perType.push({ type: t, support: support[t]!, precision: prec, recall: rec, f1 });
  }

  return {
    total: golden.length,
    correct,
    accuracy: golden.length ? correct / golden.length : 0,
    strengthChecks,
    strengthPass,
    strengthRate: strengthChecks ? strengthPass / strengthChecks : 1,
    perType,
    mistakes,
  };
}
