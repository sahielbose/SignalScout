import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { companies, people, signals, auditLogs } from '@/lib/db/schema';
import { contentHash } from '@/lib/hash';
import type { RawItem } from '@/lib/types';
import {
  normalizeDomain,
  normalizeName,
  normalizeCompanyName,
  normalizeLinkedinUrl,
  normalizeEmail,
} from './normalize';

// ─────────────────────── pure decision logic (unit-tested) ───────────────────────

export interface CompanyInput {
  name?: string | null;
  domain?: string | null;
}
export interface CompanyCandidate {
  id: string;
  domain: string | null;
  normalizedName: string | null;
}
export type CompanyDecision =
  | { action: 'match'; id: string; via: 'domain' | 'exact_name' }
  | { action: 'create'; confidence: number };

/**
 * Company strong key = registrable domain. With no domain we fall back to an
 * EXACT normalized-name match (safe dedupe for slug/filer-name sources) - never
 * a fuzzy merge. Fuzzy name overlap is only ever surfaced as a suggestion.
 */
export function decideCompanyResolution(
  input: { domain: string | null; normalizedName: string },
  candidates: CompanyCandidate[],
): CompanyDecision {
  if (input.domain) {
    const byDomain = candidates.find((c) => c.domain && c.domain === input.domain);
    if (byDomain) return { action: 'match', id: byDomain.id, via: 'domain' };
    return { action: 'create', confidence: 1 };
  }
  // domain-less: exact normalized-name match only, and only against other domain-less rows
  const byName = candidates.find(
    (c) => !c.domain && c.normalizedName && c.normalizedName === input.normalizedName && input.normalizedName.length > 0,
  );
  if (byName) return { action: 'match', id: byName.id, via: 'exact_name' };
  return { action: 'create', confidence: 0.6 };
}

export interface PersonInput {
  fullName: string;
  normalizedName: string;
  linkedinUrl: string | null;
  email: string | null;
  companyId: string | null;
}
export interface PersonCandidate {
  id: string;
  linkedinUrl: string | null;
  email: string | null;
  normalizedName: string | null;
  companyId: string | null;
}
export type PersonDecision =
  | { action: 'match'; id: string; via: 'linkedin' | 'email' }
  | { action: 'create'; confidence: number; suggestion?: { id: string; reason: string } };

/**
 * Person strong keys = LinkedIn URL OR email. NEVER auto-merge on name alone:
 * "John Doe, PM" collides with dozens of humans. A name(+company) overlap creates
 * a SEPARATE low-confidence row and records a suggestion for human review.
 */
export function decidePersonResolution(
  input: PersonInput,
  candidates: PersonCandidate[],
): PersonDecision {
  if (input.linkedinUrl) {
    const m = candidates.find((c) => c.linkedinUrl && c.linkedinUrl === input.linkedinUrl);
    if (m) return { action: 'match', id: m.id, via: 'linkedin' };
  }
  if (input.email) {
    const m = candidates.find((c) => c.email && c.email === input.email);
    if (m) return { action: 'match', id: m.id, via: 'email' };
  }
  // no strong key → never merge. Suggest if a same-name (+ same company) row exists.
  const hasStrongKey = !!(input.linkedinUrl || input.email);
  const nameTwin = candidates.find(
    (c) => c.normalizedName && c.normalizedName === input.normalizedName && input.normalizedName.length > 0,
  );
  const sameCompanyTwin = nameTwin && input.companyId && nameTwin.companyId === input.companyId;
  const confidence = hasStrongKey ? 1 : sameCompanyTwin ? 0.5 : 0.4;
  const suggestion = nameTwin
    ? { id: nameTwin.id, reason: sameCompanyTwin ? 'same name + same company' : 'same name' }
    : undefined;
  return { action: 'create', confidence, suggestion };
}

// ─────────────────────────── DB-backed resolution ───────────────────────────

export async function resolveCompany(input: CompanyInput): Promise<string | null> {
  const domain = normalizeDomain(input.domain);
  const normalizedName = normalizeCompanyName(input.name);
  if (!domain && !normalizedName) return null;

  // gather candidates: by domain (if any) + by exact normalized name
  const candidates: CompanyCandidate[] = await db
    .select({ id: companies.id, domain: companies.domain, normalizedName: companies.normalizedName })
    .from(companies)
    .where(
      domain
        ? eq(companies.domain, domain)
        : and(isNull(companies.domain), eq(companies.normalizedName, normalizedName)),
    )
    .limit(10);

  const decision = decideCompanyResolution({ domain, normalizedName }, candidates);
  if (decision.action === 'match') {
    // opportunistically backfill a missing domain/name
    if (domain || input.name) {
      await db
        .update(companies)
        .set({
          ...(domain ? { domain } : {}),
          ...(input.name ? { name: input.name } : {}),
          updatedAt: new Date(),
        })
        .where(eq(companies.id, decision.id));
    }
    return decision.id;
  }

  // create - guard the domain unique constraint with onConflict
  const [row] = await db
    .insert(companies)
    .values({ domain: domain ?? null, name: input.name ?? null, normalizedName })
    .onConflictDoUpdate({
      target: companies.domain,
      set: { name: input.name ?? null, normalizedName, updatedAt: new Date() },
    })
    .returning({ id: companies.id });
  return row?.id ?? null;
}

export interface PersonResolveInput {
  fullName: string;
  linkedinUrl?: string | null;
  email?: string | null;
  githubLogin?: string | null;
  companyId?: string | null;
  title?: string | null;
  location?: string | null;
}

export async function resolvePerson(input: PersonResolveInput): Promise<string | null> {
  const fullName = input.fullName?.trim();
  if (!fullName) return null;
  const linkedinUrl = normalizeLinkedinUrl(input.linkedinUrl);
  const email = normalizeEmail(input.email);
  const normalizedName = normalizeName(fullName);

  // candidates: strong-key matches + same-name rows (for suggestions only)
  const candidates: PersonCandidate[] = await db
    .select({
      id: people.id,
      linkedinUrl: people.linkedinUrl,
      email: people.email,
      normalizedName: people.normalizedName,
      companyId: people.companyId,
    })
    .from(people)
    .where(
      sql`(${people.linkedinUrl} is not null and ${people.linkedinUrl} = ${linkedinUrl ?? ''})
        or (${people.email} is not null and ${people.email} = ${email ?? ''})
        or ${people.normalizedName} = ${normalizedName}`,
    )
    .limit(25);

  const decision = decidePersonResolution(
    { fullName, normalizedName, linkedinUrl, email, companyId: input.companyId ?? null },
    candidates,
  );

  if (decision.action === 'match') {
    await db
      .update(people)
      .set({
        ...(input.title ? { title: input.title } : {}),
        ...(input.location ? { location: input.location } : {}),
        ...(input.githubLogin ? { githubLogin: input.githubLogin } : {}),
        ...(input.companyId ? { companyId: input.companyId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(people.id, decision.id));
    return decision.id;
  }

  const [row] = await db
    .insert(people)
    .values({
      fullName,
      normalizedName,
      linkedinUrl,
      email,
      githubLogin: input.githubLogin ?? null,
      companyId: input.companyId ?? null,
      title: input.title ?? null,
      location: input.location ?? null,
      confidence: decision.confidence,
    })
    .returning({ id: people.id });

  const newId = row?.id ?? null;
  if (newId && decision.suggestion) {
    // record a non-destructive match SUGGESTION for review - we did NOT merge.
    await db.insert(auditLogs).values({
      orgId: null,
      actor: 'entity-resolver',
      action: 'person.match_suggested',
      subjectType: 'person',
      subjectId: newId,
      detail: {
        candidateId: decision.suggestion.id,
        reason: decision.suggestion.reason,
        confidence: decision.confidence,
        note: 'kept separate - no strong key; name match is a suggestion only',
      },
    });
  }
  return newId;
}

// ──────────────────────────────── ingestion ────────────────────────────────

export interface IngestResult {
  inserted: boolean;
  signalId: string | null;
  companyId: string | null;
  personId: string | null;
}

export function computeContentHash(item: RawItem): string {
  return contentHash(item.externalId, item.title ?? '', item.text);
}

export async function ingestRawItem(item: RawItem): Promise<IngestResult> {
  let companyId: string | null = null;
  let personId: string | null = null;

  if (item.actor.domain || item.actor.kind === 'company') {
    companyId = await resolveCompany({ name: item.actor.name, domain: item.actor.domain ?? null });
  }
  if (item.actor.kind === 'person') {
    personId = await resolvePerson({
      fullName: item.actor.name,
      linkedinUrl: item.actor.linkedinUrl ?? null,
      email: item.actor.email ?? null,
      githubLogin: item.actor.githubLogin ?? null,
      companyId,
      title: item.actor.title ?? null,
      location: item.actor.location ?? null,
    });
  }

  const hash = computeContentHash(item);
  const [row] = await db
    .insert(signals)
    .values({
      source: item.source,
      sourceUrl: item.url,
      externalId: item.externalId,
      contentHash: hash,
      companyId,
      personId,
      title: item.title ?? null,
      rawContent: item.text,
      classification: item.hintType ? { hint: item.hintType } : {},
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    })
    .onConflictDoNothing({ target: [signals.source, signals.contentHash] })
    .returning({ id: signals.id });

  return {
    inserted: !!row,
    signalId: row?.id ?? null,
    companyId,
    personId,
  };
}

export async function ingestMany(items: RawItem[]): Promise<{ inserted: number; skipped: number; results: IngestResult[] }> {
  const results: IngestResult[] = [];
  let inserted = 0;
  let skipped = 0;
  for (const item of items) {
    const r = await ingestRawItem(item);
    results.push(r);
    if (r.inserted) inserted++;
    else skipped++;
  }
  return { inserted, skipped, results };
}
