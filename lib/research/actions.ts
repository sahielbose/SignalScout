'use server';

import { requireOrgId } from '@/lib/auth/session';
import { normalizeLinkedinUrl } from '@/lib/entity/normalize';
import { generateDossier, type DossierResult } from './agent';

export interface ResearchActionResult {
  ok: boolean;
  error?: string;
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
  const orgId = await requireOrgId();

  let name = (input.name ?? '').trim();
  const linkedinUrl = normalizeLinkedinUrl(input.linkedinUrl);
  // allow a bare linkedin url with no name (derive a placeholder from the slug)
  if (!name && linkedinUrl) {
    const slug = linkedinUrl.split('/in/')[1]?.replace(/-/g, ' ') ?? '';
    name = slug.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (!name) return { ok: false, error: 'Enter a name (or a LinkedIn profile URL).' };

  try {
    const result = await generateDossier({
      name,
      company: input.company?.trim() || null,
      domain: input.domain?.trim() || null,
      linkedinUrl,
      githubLogin: input.githubLogin?.trim() || null,
      personId: input.personId || null,
      orgId,
      force: input.force,
    });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
