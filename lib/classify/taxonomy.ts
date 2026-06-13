import type { SignalType } from '@/lib/types';

export interface TaxonomyEntry {
  type: SignalType;
  label: string;
  description: string;
  /** lexical cues used by the deterministic mock classifier + as prompt hints */
  cues: string[];
  /** base buying-signal strength before ICP relevance adjustment */
  baseStrength: number;
}

export const TAXONOMY: Record<SignalType, TaxonomyEntry> = {
  funding: {
    type: 'funding',
    label: 'Funding',
    description: 'Raised capital - a round, a Form D/Reg D offering, an S-1, a funding announcement.',
    cues: ['raised', 'series ', 'seed round', 'funding', 'form d', 'reg d', 'offering', 'investment', 'led by', 'venture'],
    baseStrength: 0.72,
  },
  hiring: {
    type: 'hiring',
    label: 'Hiring',
    description: 'Opening roles / growing headcount (non-GTM).',
    cues: ['hiring', 'is hiring', 'open role', 'job', 'engineer', 'we are looking'],
    baseStrength: 0.42,
  },
  product_launch: {
    type: 'product_launch',
    label: 'Product Launch',
    description: 'Shipped/launched a new product, API, or major feature.',
    cues: ['launch', 'launching', 'introducing', 'announcing', 'now available', 'ga', 'general availability', 'shipped', 'new api'],
    baseStrength: 0.62,
  },
  buying_intent: {
    type: 'buying_intent',
    label: 'Buying Intent',
    description: 'Explicit signal they are evaluating / spending in a category (RFP, spend report, "evaluating", migration).',
    cues: ['evaluating', 'migrating to', 'rfp', 'looking for a', 'switching to', 'spend', 'budget for'],
    baseStrength: 0.78,
  },
  expansion: {
    type: 'expansion',
    label: 'Expansion',
    description: 'GTM/revenue expansion - opening a new market, building a sales team, new office, GTM hiring.',
    cues: ['account executive', 'gtm', 'go-to-market', 'sales lead', 'head of sales', 'new office', 'expanding to', 'revenue'],
    baseStrength: 0.6,
  },
  thought_leadership: {
    type: 'thought_leadership',
    label: 'Thought Leadership',
    description: 'Published research, a talk, a conference paper, a high-signal post.',
    cues: ['published', 'keynote', 'paper', 'neurips', 'spoke at', 'talk at', 'whitepaper', 'research'],
    baseStrength: 0.42,
  },
  event: {
    type: 'event',
    label: 'Event',
    description: 'Hosting/attending a meetup, conference, or event.',
    cues: ['event', 'meetup', 'conference', 'rsvp', 'workshop', 'summit', 'webinar'],
    baseStrength: 0.4,
  },
  sec_filing: {
    type: 'sec_filing',
    label: 'SEC Filing',
    description: 'A material SEC filing that is not itself a funding event (8-K, Form 4, etc.).',
    cues: ['8-k', 'form 4', 'filed', 'sec', '10-k', '10-q'],
    baseStrength: 0.4,
  },
  github_release: {
    type: 'github_release',
    label: 'GitHub Release',
    description: 'A software release / version tag.',
    cues: ['released', 'release', 'version', 'v1', 'v2', 'changelog', 'tag'],
    baseStrength: 0.46,
  },
  content: {
    type: 'content',
    label: 'Content',
    description: 'A website/blog/changelog content change with no stronger classification.',
    cues: ['blog', 'post', 'content change', 'updated', 'changelog'],
    baseStrength: 0.34,
  },
  partnership: {
    type: 'partnership',
    label: 'Partnership',
    description: 'A partnership or integration announcement.',
    cues: ['partnership', 'partnered', 'integration', 'now integrates', 'collaboration', 'teams up'],
    baseStrength: 0.52,
  },
};

export const TAXONOMY_LIST = Object.values(TAXONOMY);
