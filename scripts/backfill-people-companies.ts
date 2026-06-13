/**
 * Backfill people.company_id for people that have none.
 *
 * For every person with a NULL company_id we try to discover the company NAME
 * from (in priority order):
 *   1. their latest dossier's structured.company.value (or identity company),
 *   2. people.metadata.company / companyName,
 *   3. a company suffix parsed out of their title (e.g. "CEO & Founder, Vercel").
 *
 * We then call resolveCompany({ name }) - the shared entity resolver - to get or
 * create the company id (it dedupes by exact normalized name when domain-less and
 * never fuzzy-merges) and UPDATE people SET company_id.
 *
 * Run: pnpm tsx scripts/backfill-people-companies.ts
 */
import { eq, isNull, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { people, dossiers } from '@/lib/db/schema';
import { resolveCompany } from '@/lib/entity/resolution';

/** Pull a company name out of a free-form title like "CEO & Founder, Vercel". */
function companyFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  // Common patterns: "<role>, <Company>", "<role> at <Company>", "<role> @ <Company>".
  const at = title.match(/\b(?:at|@)\s+(.+)$/i);
  if (at?.[1]) return at[1].trim();
  const comma = title.split(',');
  if (comma.length > 1) {
    const tail = comma[comma.length - 1]?.trim();
    // A trailing comma segment is only a company if it does not look like a role.
    if (tail && !/\b(ceo|cto|cfo|coo|founder|chief|head|vp|lead|director|manager|engineer|developer|officer|president)\b/i.test(tail)) {
      return tail;
    }
  }
  return null;
}

function nameFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const candidate = meta.company ?? meta.companyName ?? meta.employer;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

async function main() {
  const rows = await db
    .select({ id: people.id, fullName: people.fullName, title: people.title, metadata: people.metadata })
    .from(people)
    .where(isNull(people.companyId));

  console.log(`Found ${rows.length} people with no company link.`);

  let linked = 0;
  let skipped = 0;

  for (const p of rows) {
    // 1. latest dossier company.
    const [dossier] = await db
      .select({ structured: dossiers.structured })
      .from(dossiers)
      .where(eq(dossiers.personId, p.id))
      .orderBy(desc(dossiers.createdAt))
      .limit(1);

    const dossierCompany =
      (dossier?.structured?.company?.value && dossier.structured.company.value.trim()) || null;

    const name = dossierCompany ?? nameFromMetadata(p.metadata) ?? companyFromTitle(p.title);

    if (!name) {
      skipped++;
      continue;
    }

    const companyId = await resolveCompany({ name });
    if (!companyId) {
      skipped++;
      continue;
    }

    await db.update(people).set({ companyId, updatedAt: new Date() }).where(eq(people.id, p.id));
    linked++;
    console.log(`  linked ${p.fullName} -> "${name}" (${companyId})`);
  }

  console.log(`\nDone. Linked ${linked} people to companies, skipped ${skipped} (no company name found).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
