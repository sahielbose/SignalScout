/**
 * Classification eval harness — the project's CI gate.
 * Runs the live classifier over hand-labeled golden items, prints per-type
 * precision/recall/F1, and EXITS NON-ZERO on regression below thresholds.
 *   pnpm eval
 */
import 'dotenv/config';
import { runClassificationEval } from '@/lib/evals/report';
import { hasLLM } from '@/lib/env';

const OVERALL_ACCURACY_MIN = 0.8;
const RECALL_FLOOR = 0.6;
const MIN_SUPPORT_FOR_RECALL = 3;
const STRENGTH_MIN = 0.8;

async function main() {
  const r = await runClassificationEval();
  console.log(`\nClassification eval — ${r.total} labeled items (LLM: ${hasLLM() ? 'real' : 'mock'})\n`);
  console.log('  type'.padEnd(22) + 'support  precision  recall   f1');
  console.log('  ' + '─'.repeat(56));

  const failures: string[] = [];
  for (const t of r.perType) {
    console.log(
      `  ${t.type.padEnd(20)}${String(t.support).padStart(5)}    ${t.precision.toFixed(2).padStart(6)}    ${t.recall.toFixed(2).padStart(5)}  ${t.f1.toFixed(2).padStart(5)}`,
    );
    if (t.support >= MIN_SUPPORT_FOR_RECALL && t.recall < RECALL_FLOOR) {
      failures.push(`recall for "${t.type}" = ${t.recall.toFixed(2)} < ${RECALL_FLOOR}`);
    }
  }

  console.log('\n  overall accuracy : ' + r.accuracy.toFixed(3) + ` (${r.correct}/${r.total})`);
  console.log('  strength gate    : ' + r.strengthRate.toFixed(3) + ` (${r.strengthPass}/${r.strengthChecks})`);
  if (r.accuracy < OVERALL_ACCURACY_MIN) failures.push(`accuracy ${r.accuracy.toFixed(3)} < ${OVERALL_ACCURACY_MIN}`);
  if (r.strengthRate < STRENGTH_MIN) failures.push(`strength gate ${r.strengthRate.toFixed(3)} < ${STRENGTH_MIN}`);

  if (r.mistakes.length) {
    console.log('\n  misclassifications:');
    for (const m of r.mistakes) console.log('  • ' + m);
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
