import { type Dossier, type Fact, type DossierStructured, type DossierSource } from '@/lib/types';

export function isValidHttpUrl(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isCited(f: Fact | undefined | null): f is Fact {
  return !!f && isValidHttpUrl(f.source_url) && typeof f.snippet === 'string' && f.snippet.trim().length > 0;
}

/** Every Fact present in structured{} (singletons + arrays). */
export function collectFacts(s: DossierStructured): Fact[] {
  const out: Fact[] = [];
  const push = (f?: Fact) => f && out.push(f);
  push(s.role);
  push(s.company);
  push(s.github_contributions);
  push(s.focus);
  for (const f of s.talks ?? []) out.push(f);
  for (const f of s.publications ?? []) out.push(f);
  for (const f of s.starred_repos ?? []) out.push(f);
  return out;
}

/** Drop every fact lacking a valid http(s) source_url + snippet. */
export function dropUncited(s: DossierStructured): DossierStructured {
  const keep = (f?: Fact) => (isCited(f) ? f : undefined);
  return {
    role: keep(s.role),
    company: keep(s.company),
    github_contributions: keep(s.github_contributions),
    focus: keep(s.focus),
    talks: (s.talks ?? []).filter(isCited),
    publications: (s.publications ?? []).filter(isCited),
    starred_repos: (s.starred_repos ?? []).filter(isCited),
  };
}

export interface GuardedDossier extends Dossier {
  lowConfidence: boolean;
  sources: DossierSource[];
}

export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Citation guard: confidence = cited/total BEFORE dropping, then drop uncited
 * facts and mark low-confidence. A plausible-but-uncited dossier collapses to an
 * honest, mostly-empty one rather than a confident fabrication.
 */
export function enforceCitations(d: Dossier): GuardedDossier {
  const allFacts = collectFacts(d.structured);
  const cited = allFacts.filter(isCited);
  const confidence = allFacts.length ? cited.length / allFacts.length : 0;
  const structured = dropUncited(d.structured);

  const sources: DossierSource[] = collectFacts(structured).map((f) => ({
    claim: f.value,
    url: f.source_url,
    snippet: f.snippet,
  }));

  return {
    ...d,
    structured,
    confidence: Math.round(confidence * 100) / 100,
    lowConfidence: confidence < LOW_CONFIDENCE_THRESHOLD,
    sources,
  };
}
