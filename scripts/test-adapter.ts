/**
 * Smoke-test a source adapter against REAL endpoints (no DB writes).
 *   pnpm test-adapter greenhouse stripe
 *   pnpm test-adapter lever netflix
 *   pnpm test-adapter ashby ramp
 *   pnpm test-adapter github facebook/react
 *   pnpm test-adapter sec 320193           # Apple's CIK
 *   pnpm test-adapter sec form-d            # recent Form D discovery
 *   pnpm test-adapter web https://stripe.com/blog
 *   pnpm test-adapter luma https://lu.ma/<event>
 */
import 'dotenv/config';
import { RawItemSchema } from '@/lib/types';
import { getAdapter } from '@/lib/adapters';

async function main() {
  const [, , source, key] = process.argv;
  if (!source || !key) {
    console.error('usage: pnpm test-adapter <source> <key>');
    process.exit(2);
  }
  const adapter = getAdapter(source);
  console.log(`\n▶ ${adapter.label} - key="${key}"\n`);
  const t0 = Date.now();
  const { items, cursor } = await adapter.fetch({ key, limit: 5 });
  const ms = Date.now() - t0;

  let valid = 0;
  for (const item of items.slice(0, 5)) {
    const parsed = RawItemSchema.safeParse(item);
    if (parsed.success) valid++;
    else console.error('  ✗ invalid RawItem:', parsed.error.issues.map((i) => i.path.join('.')));
    console.log(`  • [${item.hintType ?? '?'}] ${item.actor.name}`);
    console.log(`    ${item.title ?? ''}`);
    console.log(`    ${item.url}`);
    console.log(`    ${(item.text || '').replace(/\s+/g, ' ').slice(0, 120)}…\n`);
  }
  console.log(`fetched ${items.length} item(s) in ${ms}ms - ${valid}/${Math.min(items.length, 5)} schema-valid`);
  console.log('cursor:', JSON.stringify(cursor));
  if (items.length === 0) {
    console.warn('\n⚠ zero items - endpoint reachable but empty (or all filtered by cursor).');
  }
  if (items.length > 0 && valid === 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n✗ adapter failed:', err?.message ?? err);
  process.exit(1);
});
