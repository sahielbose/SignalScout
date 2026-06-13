import type { SignalType, IcpDefinition } from '@/lib/types';

/**
 * Keyword/industry/title relevance of a signal to an ICP. The ICP's signalTypes,
 * when set, are a HARD filter (precision over recall). Shared by the mock
 * classifier and the backfill that matches existing signals to a new ICP.
 */
export function icpRelevanceScore(text: string, type: SignalType, def: IcpDefinition): number {
  const t = text.toLowerCase();
  // Exclude keywords are a HARD veto: any hit disqualifies the signal entirely,
  // regardless of how well the positive keywords/industries/titles line up.
  for (const ex of def.excludeKeywords ?? []) if (ex && t.includes(ex.toLowerCase())) return 0;
  let s = 0;
  for (const kw of def.keywords ?? []) if (kw && t.includes(kw.toLowerCase())) s += 1;
  for (const ind of def.industries ?? []) if (ind && t.includes(ind.toLowerCase())) s += 0.8;
  for (const title of def.titles ?? []) if (title && t.includes(title.toLowerCase())) s += 0.6;
  for (const geo of def.geos ?? []) if (geo && t.includes(geo.toLowerCase())) s += 0.4;
  const wantsTypes = def.signalTypes ?? [];
  if (wantsTypes.length) {
    if (!wantsTypes.includes(type)) return 0;
    s += 0.5;
  }
  return s;
}

export const ICP_MATCH_THRESHOLD = 1;

export function signalMatchesIcp(text: string, type: SignalType, def: IcpDefinition): boolean {
  return icpRelevanceScore(text, type, def) >= ICP_MATCH_THRESHOLD;
}
