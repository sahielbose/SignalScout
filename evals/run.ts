/**
 * Classification eval harness — the project's CI gate.
 * Loads hand-labeled real items from evals/golden/classification/*.json, runs the
 * live classifier, prints per-type precision/recall/F1, and EXITS NON-ZERO on
 * regression below thresholds. Re-run on every prompt/classifier change.
 *   pnpm eval
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { RawItemSchema, SignalTypeSchema, SIGNAL_TYPES, type SignalType, type IcpDefinition } from '@/lib/types';
import { classify } from '@/lib/classify/classifier';
import { setLlmLogging } from '@/lib/providers/llm';
import { hasLLM } from '@/lib/env';

setLlmLogging(false); // eval needs no DB

const GoldenItemSchema = z.object({
  input: RawItemSchema,
  expected: z.object({
    type: SignalTypeSchema,
    min_strength: z.number().min(0).max(1).optional(),
  }),
  note: z.string().optional(),
});
type GoldenItem = z.infer<typeof GoldenItemSchema>;

// Broad eval ICP so every item gets ICP context + a strength (no hard type filter).
const EVAL_ICP: { id: string; name: string; definition: IcpDefinition } = {
  id: 'eval-icp',
  name: 'Eval — broad B2B',
  definition: {
    industries: ['fintech', 'developer tools', 'saas', 'ai', 'payments', 'infrastructure', 'data'],
    titles: ['account executive', 'sales', 'engineer', 'product', 'gtm', 'revenue'],
    keywords: ['api', 'payments', 'developer', 'platform', 'data', 'sdk', 'sales', 'revenue', 'cloud', 'security', 'launch'],
    geos: ['United States', 'EMEA', 'Remote'],
    signalTypes: [], // empty = no hard filter for the eval
    notify: { email: false, slack: false },
    notifyThreshold: 0.7,
  },
};

// Per-type thresholds (recall floor for types with enough support).
const OVERALL_ACCURACY_MIN = 0.8;
const RECALL_FLOOR = 0.6;
const MIN_SUPPORT_FOR_RECALL = 3;

function loadGolden(): GoldenItem[] {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'golden', 'classification');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const items: GoldenItem[] = [];
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const arr = Array.isArray(raw) ? raw : [raw];
    for (const entry of arr) {
      const parsed = GoldenItemSchema.safeParse(entry);
      if (!parsed.success) {
        console.error(`✗ invalid golden item in ${f}:`, parsed.error.issues.map((i) => i.path.join('.')));
        process.exit(2);
      }
      items.push(parsed.data);
    }
  }
  return items;
}

async function main() {
  const golden = loadGolden();
  console.log(`\nClassification eval — ${golden.length} labeled items (LLM: ${hasLLM() ? 'real' : 'mock'})\n`);

  const tp: Record<string, number> = {};
  const fp: Record<string, number> = {};
  const fn: Record<string, number> = {};
  const support: Record<string, number> = {};
  for (const t of SIGNAL_TYPES) {
    tp[t] = fp[t] = fn[t] = support[t] = 0;
  }

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
    const predicted = r.type;
    support[expected]!++;
    if (predicted === expected) {
      correct++;
      tp[expected]!++;
    } else {
      fp[predicted]!++;
      fn[expected]!++;
      mistakes.push(`  • "${(item.input.title ?? item.input.text).slice(0, 56)}" expected=${expected} got=${predicted}`);
    }
    if (item.expected.min_strength != null) {
      strengthChecks++;
      if (r.strength >= item.expected.min_strength) strengthPass++;
      else mistakes.push(`  • strength "${(item.input.title ?? '').slice(0, 48)}" ${r.strength} < min ${item.expected.min_strength}`);
    }
  }

  // table
  console.log('  type'.padEnd(22) + 'support  precision  recall   f1');
  console.log('  ' + '─'.repeat(56));
  const failures: string[] = [];
  for (const t of SIGNAL_TYPES) {
    if (support[t] === 0 && tp[t] === 0 && fp[t] === 0) continue;
    const prec = tp[t]! + fp[t]! ? tp[t]! / (tp[t]! + fp[t]!) : 1;
    const rec = tp[t]! + fn[t]! ? tp[t]! / (tp[t]! + fn[t]!) : 1;
    const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
    console.log(
      `  ${t.padEnd(20)}${String(support[t]).padStart(5)}    ${prec.toFixed(2).padStart(6)}    ${rec.toFixed(2).padStart(5)}  ${f1.toFixed(2).padStart(5)}`,
    );
    if (support[t]! >= MIN_SUPPORT_FOR_RECALL && rec < RECALL_FLOOR) {
      failures.push(`recall for "${t}" = ${rec.toFixed(2)} < ${RECALL_FLOOR}`);
    }
  }

  const accuracy = correct / golden.length;
  const strengthRate = strengthChecks ? strengthPass / strengthChecks : 1;
  console.log('\n  overall accuracy : ' + accuracy.toFixed(3) + ` (${correct}/${golden.length})`);
  console.log('  strength gate    : ' + strengthRate.toFixed(3) + ` (${strengthPass}/${strengthChecks})`);

  if (accuracy < OVERALL_ACCURACY_MIN) failures.push(`accuracy ${accuracy.toFixed(3)} < ${OVERALL_ACCURACY_MIN}`);
  if (strengthRate < 0.8) failures.push(`strength gate ${strengthRate.toFixed(3)} < 0.8`);

  if (mistakes.length) {
    console.log('\n  misclassifications / strength misses:');
    console.log(mistakes.join('\n'));
  }

  if (failures.length) {
    console.error('\n✗ EVAL FAILED:\n  - ' + failures.join('\n  - ') + '\n');
    process.exit(1);
  }
  console.log('\n✓ eval passed\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('eval crashed:', err);
  process.exit(1);
});
