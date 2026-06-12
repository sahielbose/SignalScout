import type { SignalType, SourceName, IcpDefinition } from '@/lib/types';
import { TAXONOMY, TAXONOMY_LIST } from './taxonomy';
import { icpRelevanceScore } from './match';

export interface MockClassifyInput {
  source: SourceName | string;
  text: string;
  title?: string;
  hint?: SignalType;
  icps: { id: string; name: string; definition: IcpDefinition }[];
}

export interface RawClassResult {
  type: SignalType;
  strength: number;
  matchedIcpIndexes: number[];
  justification: string;
}

const GTM_CUES =
  /\b(account executive|sales|gtm|go-to-market|revenue|head of sales|partnerships? (manager|lead)|business development|sdr|bdr|customer success|growth (lead|manager))\b/i;

// "strong intent" types win ties over generic ones when their cues appear.
const PRIORITY: Record<SignalType, number> = {
  buying_intent: 6,
  funding: 6,
  partnership: 5,
  product_launch: 5,
  expansion: 4,
  thought_leadership: 3,
  event: 3,
  github_release: 2,
  hiring: 2,
  sec_filing: 2,
  content: 1,
};

// Web/unknown sources can be any of these; pick by cue match.
const WEB_CANDIDATES: SignalType[] = [
  'funding',
  'buying_intent',
  'product_launch',
  'partnership',
  'thought_leadership',
  'event',
  'content',
];

/**
 * Source-aware type inference. A job posting is hiring/expansion — never
 * "partnership" because the description happens to mention partners. Only
 * free-form web content is inferred purely from cues.
 */
export function inferType(input: MockClassifyInput): SignalType {
  const t = `${input.title ?? ''} ${input.text}`.toLowerCase();
  switch (input.source) {
    case 'greenhouse':
    case 'lever':
    case 'ashby':
      // Trust the adapter's title/department-based GTM hint; otherwise check the
      // ROLE TITLE only — never the description boilerplate ("we're growing sales").
      if (input.hint === 'expansion') return 'expansion';
      if (input.hint === 'hiring') return 'hiring';
      return GTM_CUES.test(input.title ?? '') ? 'expansion' : 'hiring';
    case 'github':
      return 'github_release';
    case 'sec':
      return input.hint === 'funding' || /\b(form d|reg d|s-1|exempt offering|424)\b/.test(t)
        ? 'funding'
        : 'sec_filing';
    case 'luma':
      return 'event';
    default: {
      // web / unknown → cue-scored among content-ish types
      let best: { type: SignalType; score: number } | null = null;
      for (const entry of TAXONOMY_LIST) {
        if (!WEB_CANDIDATES.includes(entry.type)) continue;
        let cueHits = 0;
        for (const cue of entry.cues) if (t.includes(cue)) cueHits++;
        if (cueHits === 0) continue;
        const score = cueHits * 10 + PRIORITY[entry.type];
        if (!best || score > best.score) best = { type: entry.type, score };
      }
      return best?.type ?? input.hint ?? 'content';
    }
  }
}

export function mockClassify(input: MockClassifyInput): RawClassResult {
  const type = inferType(input);
  const text = `${input.title ?? ''} ${input.text}`;
  const base = TAXONOMY[type].baseStrength;

  const scores = input.icps.map((icp) => icpRelevanceScore(text, type, icp.definition));
  const matchedIcpIndexes: number[] = [];
  let bestRel = 0;
  scores.forEach((s, i) => {
    if (s >= 1) matchedIcpIndexes.push(i + 1); // 1-based
    if (s > bestRel) bestRel = s;
  });

  let strength: number;
  if (input.icps.length === 0) {
    strength = base; // pure classification, no audience to score against
  } else if (matchedIcpIndexes.length === 0) {
    strength = base * 0.55; // noise for this user
  } else {
    strength = Math.min(1, base + Math.min(0.25, bestRel * 0.06));
  }
  strength = Math.round(strength * 100) / 100;

  const names = matchedIcpIndexes.map((i) => input.icps[i - 1]?.name).filter(Boolean);
  const justification =
    `${TAXONOMY[type].label} signal` +
    (names.length ? ` relevant to ${names.join(', ')}.` : input.icps.length ? ' (no ICP match).' : '.');

  return { type, strength, matchedIcpIndexes, justification };
}
