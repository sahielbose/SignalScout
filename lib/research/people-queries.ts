import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { people, companies, dossiers } from '@/lib/db/schema';
import type { GuardedDossier } from './dossier';

export interface PersonWithContext {
  person: typeof people.$inferSelect;
  companyName: string | null;
  companyDomain: string | null;
  dossier: GuardedDossier | null;
  meta: { model: string | null; cached: boolean; createdAt: Date | null } | null;
}

export async function getPersonWithDossier(orgId: string, personId: string): Promise<PersonWithContext | null> {
  const [p] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!p) return null;

  let companyName: string | null = null;
  let companyDomain: string | null = null;
  if (p.companyId) {
    const [c] = await db.select({ name: companies.name, domain: companies.domain }).from(companies).where(eq(companies.id, p.companyId)).limit(1);
    companyName = c?.name ?? null;
    companyDomain = c?.domain ?? null;
  }

  // tenant-safe: only this org's dossier on the person
  const [d] = await db
    .select()
    .from(dossiers)
    .where(and(eq(dossiers.personId, personId), eq(dossiers.orgId, orgId)))
    .orderBy(desc(dossiers.createdAt))
    .limit(1);

  let dossier: GuardedDossier | null = null;
  let meta = null;
  if (d && d.structured) {
    dossier = {
      identity: {
        full_name: p.fullName,
        title: p.title ?? undefined,
        company: companyName ?? undefined,
        location: p.location ?? undefined,
      },
      tags: d.tags,
      structured: d.structured,
      summary: d.summary ?? undefined,
      why_they_care: d.whyTheyCare ?? '',
      suggested_opener: d.suggestedOpener ?? '',
      confidence: d.confidence,
      lowConfidence: d.lowConfidence,
      sources: d.sources,
    };
    meta = { model: d.model, cached: false, createdAt: d.createdAt };
  }

  return { person: p, companyName, companyDomain, dossier, meta };
}
