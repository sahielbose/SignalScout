'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireOrgId } from '@/lib/auth/session';
import { normalizeLinkedinUrl } from '@/lib/entity/normalize';
import { getByoKey } from '@/lib/users/service';
import { enforceQuota, QuotaError } from '@/lib/quota/service';
import { generateDossier, type DossierResult } from './agent';
import { findSimilarPeople, type SimilarResult } from './similar';

export interface ResearchActionResult {
  ok: boolean;
  error?: string;
  quotaExceeded?: boolean;
  result?: DossierResult;
}

export async function researchAction(input: {
  name?: string;
  company?: string;
  domain?: string;
  linkedinUrl?: string;
  githubLogin?: string;
  personId?: string;
  force?: boolean;
}): Promise<ResearchActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.orgId) return { ok: false, error: 'Not signed in.' };
  const orgId = session.user.orgId;
  const byoKey = await getByoKey(session.user.id);

  let name = (input.name ?? '').trim();
  const linkedinUrl = normalizeLinkedinUrl(input.linkedinUrl);
  const githubLogin = input.githubLogin?.trim() || null;
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
      domain: input.domain?.trim() || null,
      linkedinUrl,
      githubLogin,
      personId: input.personId || null,
      orgId,
      llmApiKey: byoKey,
      force: input.force,
    });
    return { ok: true, result };
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
  } catch {
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
