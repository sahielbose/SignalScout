'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireOrgId } from '@/lib/auth/session';
import { normalizeLinkedinUrl } from '@/lib/entity/normalize';
import { getByoKey } from '@/lib/users/service';
import { enforceQuota, QuotaError } from '@/lib/quota/service';
import { hasGithub } from '@/lib/providers/github-client';
import { hasSearch } from '@/lib/env';
import { generateDossier, type DossierResult } from './agent';
import { findSimilarPeople, type SimilarResult } from './similar';

/**
 * Which public sources to build the profile from. Plain words for the UI:
 * - 'github'  → only the person's public code on GitHub
 * - 'web'     → only the public web (talks, articles, company pages)
 * - 'both'    → use everything we can (recommended)
 */
export type ResearchSources = 'github' | 'web' | 'both';

/**
 * How deep to dig. 'quick' is fast and may reuse a recent cached profile;
 * 'thorough' always rebuilds from fresh sources.
 */
export type ResearchDetail = 'quick' | 'thorough';

const SOURCES = new Set<ResearchSources>(['github', 'web', 'both']);
const DETAIL = new Set<ResearchDetail>(['quick', 'thorough']);

/** What the chosen options actually did, so the UI can be honest about it. */
export interface ResearchAppliedOptions {
  sources: ResearchSources;
  detail: ResearchDetail;
  /** A plain-words heads-up shown when a source had to be skipped (missing key). */
  notice?: string;
}

export interface ResearchActionResult {
  ok: boolean;
  error?: string;
  quotaExceeded?: boolean;
  result?: DossierResult;
  applied?: ResearchAppliedOptions;
}

export async function researchAction(input: {
  name?: string;
  company?: string;
  domain?: string;
  linkedinUrl?: string;
  githubLogin?: string;
  personId?: string;
  force?: boolean;
  sources?: ResearchSources;
  detail?: ResearchDetail;
}): Promise<ResearchActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.orgId) return { ok: false, error: 'Not signed in.' };
  const orgId = session.user.orgId;
  const byoKey = await getByoKey(session.user.id);

  // Validate the new options, falling back to safe defaults on anything unexpected.
  const sources: ResearchSources = SOURCES.has(input.sources as ResearchSources) ? (input.sources as ResearchSources) : 'both';
  const detail: ResearchDetail = DETAIL.has(input.detail as ResearchDetail) ? (input.detail as ResearchDetail) : 'quick';

  let name = (input.name ?? '').trim();
  const linkedinUrl = normalizeLinkedinUrl(input.linkedinUrl);
  let githubLogin = input.githubLogin?.trim() || null;
  // allow a bare linkedin url with no name (derive a placeholder from the slug)
  if (!name && linkedinUrl) {
    const slug = linkedinUrl.split('/in/')[1]?.replace(/-/g, ' ') ?? '';
    name = slug.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  // allow a bare github handle with no name (derive a placeholder from the handle)
  if (!name && githubLogin) {
    const handle = githubLogin.replace(/^@/, '').replace(/[-_]/g, ' ');
    name = handle.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (!name) return { ok: false, error: 'Enter a name (or a LinkedIn profile URL or GitHub handle).' };

  // ── honor the "sources" choice + degrade gracefully when a provider is missing ──
  const githubReady = hasGithub();
  const webReady = hasSearch();
  let effectiveSources = sources;
  let notice: string | undefined;

  if (sources === 'github' && !githubReady) {
    // They asked for GitHub only, but no GitHub access is configured. Fall back to
    // the web (or fail clearly if the web is also unavailable) rather than silently
    // returning an empty profile.
    if (webReady) {
      effectiveSources = 'web';
      notice = 'GitHub access is not set up, so we used the public web instead.';
    } else {
      return {
        ok: false,
        error: 'GitHub access is not set up, so we cannot build a GitHub-only profile right now. Pick "Public web" or "Both", or add a GitHub token.',
        applied: { sources, detail },
      };
    }
  } else if (sources === 'web' && !webReady) {
    // They asked for the public web only, but no search provider key is set.
    if (githubReady) {
      effectiveSources = 'github';
      notice = 'Public web search is not set up, so we used public code on GitHub instead.';
    } else {
      return {
        ok: false,
        error: 'Public web search is not set up, so we cannot build a web-only profile right now. Add a search provider key, or pick "GitHub" / "Both".',
        applied: { sources, detail },
      };
    }
  } else if (sources === 'both') {
    // "Both" works with whatever is available; note anything missing so the result is honest.
    if (!githubReady && !webReady) {
      notice = 'Neither GitHub nor public web search is set up, so this profile will be limited.';
    } else if (!githubReady) {
      notice = 'GitHub access is not set up, so we used the public web only.';
    } else if (!webReady) {
      notice = 'Public web search is not set up, so we used public code on GitHub only.';
    }
  }

  // For a web-only build, do not lean on a GitHub handle for identity/synthesis.
  // (A LinkedIn URL is still allowed purely to confirm the right person.)
  if (effectiveSources === 'web') githubLogin = null;
  // For a GitHub-only build, drop the web-search domain hint so the profile is
  // anchored to the person's public code rather than company web pages.
  const domain = effectiveSources === 'github' ? null : input.domain?.trim() || null;

  try {
    // BYO-key users bypass the shared free-tier quota (they pay their own way).
    await enforceQuota(orgId, 'research', { byoKey: !!byoKey });
  } catch (err) {
    if (err instanceof QuotaError) {
      return {
        ok: false,
        quotaExceeded: true,
        error: `Daily research limit reached (${err.used}/${err.limit}). Add your own API key on the Usage page to keep going for free.`,
      };
    }
    throw err;
  }

  try {
    const result = await generateDossier({
      name,
      company: input.company?.trim() || null,
      domain,
      linkedinUrl,
      githubLogin,
      personId: input.personId || null,
      orgId,
      llmApiKey: byoKey,
      // "Thorough" always rebuilds from fresh sources; "quick" may reuse a recent
      // cached profile (unless the caller explicitly forced a refresh).
      force: input.force || detail === 'thorough',
    });
    return { ok: true, result, applied: { sources, detail, notice } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export interface SimilarActionResult {
  ok: boolean;
  error?: string;
  result?: SimilarResult;
}

/**
 * Find lookalike prospects for a person (same github org or similar focus),
 * collect them into a per-person "Matches" list, and return the matches.
 * Org-scoped via requireOrgId; degrades gracefully (never throws) when there is
 * no GitHub signal or no token.
 */
export async function findSimilarAction(personId: string): Promise<SimilarActionResult> {
  const id = personId?.trim();
  if (!id) return { ok: false, error: 'Missing person.' };

  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (err) {
    // requireOrgId redirects unauthenticated users by throwing NEXT_REDIRECT;
    // that control-flow error must propagate so the redirect actually happens.
    if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    return { ok: false, error: 'Not signed in.' };
  }

  try {
    const result = await findSimilarPeople(orgId, id);
    revalidatePath(`/people/${id}`);
    if (result.listId) revalidatePath('/lists');
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
