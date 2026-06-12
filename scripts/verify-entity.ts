/**
 * Live-DB verification of the entity-resolution invariants (BUILD_PLAN §5b / §11):
 *   1) ingesting the same items twice yields ZERO duplicate signals (content_hash)
 *   2) two different same-name people with no strong key do NOT merge
 *   3) the same LinkedIn URL DOES match (strong key)
 * Self-cleaning: removes the synthetic rows it creates.
 */
import 'dotenv/config';
import { inArray, eq } from 'drizzle-orm';
import { db, pgClient } from '@/lib/db/client';
import { signals, people, companies } from '@/lib/db/schema';
import { ingestMany, resolvePerson } from '@/lib/entity/resolution';
import type { RawItem } from '@/lib/types';

const marker = `verify-${Date.now()}`;
let ok = true;
function check(label: string, pass: boolean) {
  console.log(`  ${pass ? '✓' : '✗'} ${label}`);
  if (!pass) ok = false;
}

function sampleItems(): RawItem[] {
  return [
    {
      source: 'github',
      externalId: `${marker}/repo:1`,
      url: 'https://github.com/x/y/releases/1',
      actor: { kind: 'company', name: `VerifyCo ${marker}`, githubLogin: 'verifyco' },
      title: 'v1',
      text: 'VerifyCo released v1.0.0',
      hintType: 'github_release',
    },
    {
      source: 'greenhouse',
      externalId: `${marker}:2`,
      url: 'https://boards.greenhouse.io/verifyco/jobs/2',
      actor: { kind: 'company', name: `VerifyCo ${marker}` },
      title: 'AE',
      text: 'VerifyCo is hiring an Account Executive',
      hintType: 'expansion',
    },
    {
      source: 'sec',
      externalId: `${marker}-acc`,
      url: 'https://www.sec.gov/x',
      actor: { kind: 'company', name: `VerifyCo ${marker}` },
      title: 'Form D',
      text: 'VerifyCo filed a Form D',
      hintType: 'funding',
    },
  ];
}

async function main() {
  console.log(`\n▶ entity-resolution verification (${marker})\n`);

  // 1) dedupe
  const first = await ingestMany(sampleItems());
  const second = await ingestMany(sampleItems());
  check(`first ingest inserts 3 (got ${first.inserted})`, first.inserted === 3);
  check(`second ingest inserts 0, skips 3 (got inserted=${second.inserted}, skipped=${second.skipped})`, second.inserted === 0 && second.skipped === 3);

  // 2) two different "John Doe" with no strong key must NOT merge
  const jd1 = await resolvePerson({ fullName: `John Doe ${marker}` });
  const jd2 = await resolvePerson({ fullName: `John Doe ${marker}` });
  check(`two same-name no-strong-key people stay separate (${jd1?.slice(0, 8)} ≠ ${jd2?.slice(0, 8)})`, !!jd1 && !!jd2 && jd1 !== jd2);

  // 3) same LinkedIn URL must match
  const ln = `https://www.linkedin.com/in/${marker}`;
  const a = await resolvePerson({ fullName: `Ada L ${marker}`, linkedinUrl: ln });
  const b = await resolvePerson({ fullName: `Ada Lovelace ${marker}`, linkedinUrl: ln });
  check(`same linkedin url matches to one person (${a?.slice(0, 8)} == ${b?.slice(0, 8)})`, !!a && a === b);

  // cleanup
  const personIds = [jd1, jd2, a, b].filter((x): x is string => !!x);
  if (personIds.length) await db.delete(people).where(inArray(people.id, personIds));
  const insertedSignalIds = first.results.map((r) => r.signalId).filter((x): x is string => !!x);
  if (insertedSignalIds.length) await db.delete(signals).where(inArray(signals.id, insertedSignalIds));
  const companyIds = first.results.map((r) => r.companyId).filter((x): x is string => !!x);
  for (const cid of [...new Set(companyIds)]) await db.delete(companies).where(eq(companies.id, cid));
  console.log('\ncleanup: removed synthetic rows');

  console.log(`\n${ok ? '✓ all entity invariants hold' : '✗ INVARIANT VIOLATED'}\n`);
  await pgClient.end({ timeout: 5 });
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error('verify failed:', err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
