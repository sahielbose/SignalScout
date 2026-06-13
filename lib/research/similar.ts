import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { people, companies, dossiers } from '@/lib/db/schema';
import { getOctokit } from '@/lib/providers/github-client';
import { resolveCompany, resolvePerson } from '@/lib/entity/resolution';
import { createList, addPersonToList } from '@/lib/lists/service';
import type { DossierStructured } from '@/lib/types';

export interface SimilarPersonMatch {
  personId: string;
  name: string;
  role: string | null;
  company: string | null;
  githubLogin: string | null;
}

export interface SimilarResult {
  listId: string | null;
  listName: string;
  matches: SimilarPersonMatch[];
  /** Why nothing was found, surfaced to the UI without throwing. */
  note?: string;
}

// ─────────────────────── pattern derivation (pure) ───────────────────────

interface SeedPattern {
  /** A github org/owner to pull peers from (e.g. "vercel"). */
  githubOrg: string | null;
  /** Free-text focus keywords used as a search fallback. */
  focusTerms: string[];
  /** The seed person's own github login, excluded from results. */
  selfLogin: string | null;
  /** The seed person's company name, used as a weak company hint. */
  companyHint: string | null;
}

/** Pull a github org slug out of a profile/repo/org URL, else null. */
export function githubOrgFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)github\.com$/.test(u.hostname)) return null;
    const seg = u.pathname.split('/').filter(Boolean)[0];
    if (!seg) return null;
    // skip github reserved/non-org paths
    if (['orgs', 'users', 'about', 'features', 'topics', 'search', 'login'].includes(seg.toLowerCase())) return null;
    return seg.toLowerCase();
  } catch {
    return null;
  }
}

/** Best-effort focus terms from the dossier tags + focus fact. */
export function deriveFocusTerms(tags: string[], structured: DossierStructured | null): string[] {
  const terms = new Set<string>();
  for (const t of tags) {
    const v = t.trim();
    if (v) terms.add(v);
  }
  const focus = structured?.focus?.value?.trim();
  if (focus) {
    for (const w of focus.split(/[,/]| and /i)) {
      const v = w.trim();
      if (v.length > 2) terms.add(v);
    }
  }
  return [...terms].slice(0, 4);
}

// ─────────────────────── DB-backed lookalike search ───────────────────────

interface SeedLoad {
  pattern: SeedPattern;
  personName: string;
}

async function loadSeed(orgId: string, personId: string): Promise<SeedLoad | null> {
  const [p] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!p) return null;

  let companyHint: string | null = null;
  if (p.companyId) {
    const [c] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, p.companyId)).limit(1);
    companyHint = c?.name ?? null;
  }

  // tenant-safe: only read THIS org's dossier on the person
  const [d] = await db
    .select({ structured: dossiers.structured, tags: dossiers.tags })
    .from(dossiers)
    .where(and(eq(dossiers.personId, personId), eq(dossiers.orgId, orgId)))
    .orderBy(desc(dossiers.createdAt))
    .limit(1);

  const structured = (d?.structured ?? null) as DossierStructured | null;
  const tags = d?.tags ?? [];

  // derive a github org from: explicit login's owner, the github_contributions fact, or company fact.
  const ghFromContrib = githubOrgFromUrl(structured?.github_contributions?.source_url);
  const ghFromCompanyFact = githubOrgFromUrl(structured?.company?.source_url);
  const selfLogin = p.githubLogin?.replace(/^@/, '').trim() || null;

  const pattern: SeedPattern = {
    githubOrg: ghFromContrib ?? ghFromCompanyFact ?? null,
    focusTerms: deriveFocusTerms(tags, structured),
    selfLogin,
    companyHint,
  };

  return { pattern, personName: p.fullName };
}

interface FoundPerson {
  login: string;
  name: string | null;
  company: string | null;
  companyDomain: string | null;
  role: string | null;
  blog: string | null;
}

/** Resolve a github login to a lightweight, company-linkable profile. Never throws. */
async function fetchProfile(login: string): Promise<FoundPerson | null> {
  try {
    const octokit = await getOctokit();
    const { data: u } = await octokit.rest.users.getByUsername({ username: login });
    if (u.type && u.type !== 'User') return null; // skip orgs/bots
    const companyRaw = (u.company ?? '').replace(/^@/, '').trim() || null;
    let companyDomain: string | null = null;
    try {
      const blog = (u.blog ?? '').trim();
      if (blog) companyDomain = new URL(blog.startsWith('http') ? blog : `https://${blog}`).hostname.replace(/^www\./, '');
    } catch {
      companyDomain = null;
    }
    return {
      login: u.login,
      name: u.name?.trim() || null,
      company: companyRaw,
      companyDomain,
      role: u.bio?.split(/[.\n]/)[0]?.trim()?.slice(0, 80) || null,
      blog: u.blog || null,
    };
  } catch {
    return null;
  }
}

/** Candidate logins from the same github org, then a focus-keyword search fallback. */
async function findCandidateLogins(pattern: SeedPattern, cap: number): Promise<string[]> {
  const octokit = await getOctokit();
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (login: string) => {
    const l = login.replace(/^@/, '').trim().toLowerCase();
    if (!l || seen.has(l)) return;
    if (pattern.selfLogin && l === pattern.selfLogin.toLowerCase()) return;
    seen.add(l);
    out.push(login.replace(/^@/, '').trim());
  };

  if (pattern.githubOrg) {
    try {
      const res = await octokit.rest.orgs.listMembers({ org: pattern.githubOrg, per_page: cap + 4 });
      for (const m of res.data as Array<{ login: string }>) push(m.login);
    } catch {
      /* org may be private/404 - fall through to search */
    }
  }

  if (out.length < cap && pattern.focusTerms.length) {
    const q = pattern.focusTerms.join(' ');
    try {
      const res = await octokit.rest.search.users({ q: `${q} type:user`, per_page: cap + 4 });
      for (const i of res.data.items) push(i.login);
    } catch {
      /* search rate-limited or empty - graceful empty */
    }
  }

  return out.slice(0, cap);
}

/**
 * Find a few lookalike prospects for `personId` (same github org or similar focus),
 * resolve each as a company-linked person, and collect them into a per-person
 * "Matches" list. Caps results to control cost. Works on public GitHub data with
 * no token, and returns an empty (non-throwing) result when nothing matches.
 */
export async function findSimilarPeople(orgId: string, personId: string): Promise<SimilarResult> {
  const MAX = 5;

  const seed = await loadSeed(orgId, personId);
  if (!seed) {
    return { listId: null, listName: 'Matches', matches: [], note: 'Person not found.' };
  }

  const listName = `Matches: ${seed.personName}`.slice(0, 200);

  let logins: string[] = [];
  try {
    logins = await findCandidateLogins(seed.pattern, MAX);
  } catch {
    logins = [];
  }

  if (logins.length === 0) {
    const why = seed.pattern.githubOrg || seed.pattern.focusTerms.length
      ? 'No public matches found on GitHub yet.'
      : 'No GitHub org or focus signal on this person yet - run deep research first.';
    return { listId: null, listName, matches: [], note: why };
  }

  // Build the list once, then resolve + add each match (company-linked).
  let listId: string | null = null;
  const matches: SimilarPersonMatch[] = [];

  for (const login of logins) {
    const profile = await fetchProfile(login);
    if (!profile) continue;

    const fullName = profile.name || login;

    // resolve the found person's company first so they are company-linked
    let companyId: string | null = null;
    if (profile.company || profile.companyDomain) {
      try {
        companyId = await resolveCompany({ name: profile.company, domain: profile.companyDomain });
      } catch {
        companyId = null;
      }
    }

    let foundPersonId: string | null = null;
    try {
      foundPersonId = await resolvePerson({
        fullName,
        githubLogin: profile.login,
        companyId,
        title: profile.role,
      });
    } catch {
      foundPersonId = null;
    }
    if (!foundPersonId) continue;

    // create the list lazily on the first real match (avoids empty lists)
    if (!listId) {
      try {
        const row = await createList(orgId, listName);
        listId = row?.id ?? null;
      } catch {
        listId = null;
      }
    }
    if (listId) {
      try {
        await addPersonToList(orgId, listId, foundPersonId);
      } catch {
        /* dedupe / ownership guard - safe to ignore */
      }
    }

    matches.push({
      personId: foundPersonId,
      name: fullName,
      role: profile.role,
      company: profile.company,
      githubLogin: profile.login,
    });
    if (matches.length >= MAX) break;
  }

  if (matches.length === 0) {
    return { listId: null, listName, matches: [], note: 'Found candidates but none resolved to a usable profile.' };
  }

  return { listId, listName, matches };
}
