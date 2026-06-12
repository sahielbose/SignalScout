/**
 * Cross-tenant isolation check (Phase 11). Creates two orgs with data and proves
 * org B cannot read org A's ICPs, lists, list members, dossiers, feed, or key.
 * Enforced-scoping model (every query takes orgId) — this is the fail-closed test.
 * Self-cleaning.
 */
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { db, pgClient } from '@/lib/db/client';
import { organizations, companies, people, signals, dossiers } from '@/lib/db/schema';
import { createIcp, listIcps } from '@/lib/icp/service';
import { createList, addCompanyToList, getListMembers, listLists } from '@/lib/lists/service';
import { getPersonWithDossier } from '@/lib/research/people-queries';
import { createApiKey, verifyApiKey } from '@/lib/apikeys/service';
import { getFeed } from '@/lib/feed/queries';
import type { IcpDefinition } from '@/lib/types';

let ok = true;
function check(label: string, pass: boolean) {
  console.log(`  ${pass ? '✓' : '✗'} ${label}`);
  if (!pass) ok = false;
}

const ICP: IcpDefinition = {
  industries: ['x'], titles: [], companySize: undefined, keywords: ['x'], geos: [],
  signalTypes: ['funding'], notify: { email: false, slack: false }, notifyThreshold: 0.7,
};

async function main() {
  console.log('\n▶ cross-tenant isolation verification\n');

  const [orgA] = await db.insert(organizations).values({ name: 'Tenant A' }).returning();
  const [orgB] = await db.insert(organizations).values({ name: 'Tenant B' }).returning();
  const A = orgA!.id;
  const B = orgB!.id;

  // A's data
  const icpA = await createIcp(A, 'A ICP secret', ICP);
  const listA = await createList(A, 'A list secret');
  const [companyA] = await db.insert(companies).values({ name: 'AcmeA', normalizedName: 'acmea' }).returning();
  await addCompanyToList(A, listA!.id, companyA!.id);
  const [personA] = await db.insert(people).values({ fullName: 'Person A', normalizedName: 'person a' }).returning();
  await db.insert(dossiers).values({ personId: personA!.id, orgId: A, structured: { role: { value: 'r', source_url: 'https://x.com', snippet: 's' } }, sources: [], tags: [], confidence: 1, lowConfidence: false });
  const [sigA] = await db.insert(signals).values({ source: 'sec', contentHash: `tenancy-${Date.now()}`, matchedIcpIds: [icpA!.id], type: 'funding', strength: 0.9 }).returning();
  const keyA = await createApiKey(A, 'A key');

  // B's data (so B has its own ICP for getFeed)
  await createIcp(B, 'B ICP', ICP);

  // ── isolation assertions from B's perspective ──
  const bIcps = await listIcps(B);
  check('B.listIcps excludes A\'s ICP', !bIcps.some((i) => i.id === icpA!.id));

  const bLists = await listLists(B);
  check('B.listLists excludes A\'s list', !bLists.some((l) => l.id === listA!.id));

  const bSeesAMembers = await getListMembers(B, listA!.id);
  check('B.getListMembers(A\'s list) returns nothing (fail-closed)', bSeesAMembers.length === 0);

  const bSeesAPerson = await getPersonWithDossier(B, personA!.id);
  check('B sees the public person but NOT A\'s dossier', !!bSeesAPerson && bSeesAPerson.dossier === null);

  const bFeed = await getFeed(B, {}, 0);
  check('B.getFeed excludes A\'s matched signal', !bFeed.items.some((s) => s.id === sigA!.id));

  const verified = await verifyApiKey(keyA.key);
  check('A\'s API key resolves to org A, never B', verified?.orgId === A && verified?.orgId !== B);

  // cleanup (cascade from orgs handles icps/lists/keys/dossiers/quota)
  await db.delete(signals).where(inArray(signals.id, [sigA!.id]));
  await db.delete(people).where(inArray(people.id, [personA!.id]));
  await db.delete(companies).where(inArray(companies.id, [companyA!.id]));
  await db.delete(organizations).where(inArray(organizations.id, [A, B]));
  console.log('\ncleanup: removed both tenants');

  console.log(`\n${ok ? '✓ tenants are isolated (fail-closed)' : '✗ TENANT LEAK'}\n`);
  await pgClient.end({ timeout: 5 });
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error('verify failed:', err);
  await pgClient.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
