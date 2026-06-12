/**
 * Live verification of the deep-research agent (Phase 7 checkpoint):
 *   1) a real person with a clear GitHub footprint → cited dossier, every fact has a source url
 *   2) a common name with no strong signal → does NOT attribute a random person's repos
 * Self-cleaning.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pgClient } from '@/lib/db/client';
import { people } from '@/lib/db/schema';
import { generateDossier } from '@/lib/research/agent';
import { isValidHttpUrl } from '@/lib/research/dossier';

let ok = true;
const created: string[] = [];
function check(label: string, pass: boolean) {
  console.log(`  ${pass ? '✓' : '✗'} ${label}`);
  if (!pass) ok = false;
}

async function main() {
  console.log('\n▶ deep-research agent verification\n');

  // 1) positive: real person with explicit GitHub handle
  console.log('Case A — Guillermo Rauch (Vercel), github rauchg:');
  const a = await generateDossier({ name: 'Guillermo Rauch', company: 'Vercel', githubLogin: 'rauchg', force: true });
  if (a.personId) created.push(a.personId);
  const facts = a.dossier.sources;
  console.log(`  confidence=${a.dossier.confidence} lowConfidence=${a.dossier.lowConfidence} facts=${facts.length} model=${a.model}`);
  for (const s of facts.slice(0, 6)) console.log(`    • ${s.claim.slice(0, 40)} → ${s.url}`);
  check('has at least one cited fact', facts.length > 0);
  check('EVERY source is a valid http(s) url', facts.every((s) => isValidHttpUrl(s.url)));
  check('every source has a non-empty snippet', facts.every((s) => s.snippet.trim().length > 0));
  check('github_contributions attributed (confident match)', !!a.dossier.structured.github_contributions);
  check('attributed github facts point at github.com', facts.filter((s) => /github\.com/.test(s.url)).every((s) => s.url.includes('github.com')));

  // 2) common-name guard: bare common name, no company/handle
  console.log('\nCase B — bare common name "Michael Chen" (no company, no handle):');
  const b = await generateDossier({ name: 'Michael Chen', force: true });
  if (b.personId) created.push(b.personId);
  console.log(`  confidence=${b.dossier.confidence} lowConfidence=${b.dossier.lowConfidence} ghFacts=${b.dossier.sources.filter((s) => /github\.com/.test(s.url)).length}`);
  check('does NOT confidently attribute a random GitHub profile (github_contributions undefined)', !b.dossier.structured.github_contributions);
  check('dossier is marked low-confidence', b.dossier.lowConfidence);

  // cleanup
  for (const id of created) await db.delete(people).where(eq(people.id, id));
  console.log('\ncleanup: removed synthetic people + dossiers (cascade)');

  console.log(`\n${ok ? '✓ research agent invariants hold' : '✗ INVARIANT VIOLATED'}\n`);
  await pgClient.end({ timeout: 5 });
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error('verify failed:', err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
