import type { RawItem } from '@/lib/types';
import type { Adapter, AdapterInput, AdapterResult, AdapterCursor } from './types';
import { isNewer } from './types';
import { httpJson } from './http';
import { stripHtml } from './html';

export interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number; // epoch ms
  categories?: { team?: string; location?: string; commitment?: string; department?: string };
  descriptionPlain?: string;
}

const GTM_HINTS =
  /\b(sales|account executive|gtm|go-to-market|revenue|marketing|growth|business development|bdr|sdr|partnerships?|customer success)\b/i;

export function mapLeverPosting(company: string, p: LeverPosting): RawItem {
  const team = p.categories?.team ?? p.categories?.department;
  const loc = p.categories?.location;
  const publishedAt = p.createdAt ? new Date(p.createdAt).toISOString() : undefined;
  const gtm = GTM_HINTS.test(p.text) || (team ? GTM_HINTS.test(team) : false);
  const body = (p.descriptionPlain ?? '').slice(0, 1200);
  return {
    source: 'lever',
    externalId: `${company}:${p.id}`,
    url: p.hostedUrl,
    publishedAt,
    actor: { kind: 'company', name: prettyToken(company) },
    title: p.text,
    text:
      `${prettyToken(company)} is hiring: ${p.text}` +
      (loc ? ` (${loc})` : '') +
      (team ? ` - ${team}` : '') +
      (body ? `\n${body}` : ''),
    hintType: gtm ? 'expansion' : 'hiring',
    meta: { company, postingId: p.id, team, location: loc, gtm },
  };
}

function prettyToken(token: string): string {
  return token.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export const leverAdapter: Adapter = {
  source: 'lever',
  label: 'Lever',
  intervalSec: 3600,
  async fetch({ key, cursor, limit }: AdapterInput): Promise<AdapterResult> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(key)}?mode=json`;
    const postings = await httpJson<LeverPosting[]>(url);
    const arr = Array.isArray(postings) ? postings : [];
    const fresh = arr
      .filter((p) => isNewer(p.createdAt ? new Date(p.createdAt).toISOString() : undefined, cursor))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, limit ?? 100);
    const items = fresh.map((p) => mapLeverPosting(key, p));
    const newestMs = arr.reduce((max, p) => Math.max(max, p.createdAt ?? 0), 0);
    const newCursor: AdapterCursor = {
      lastSeenAt: newestMs ? new Date(newestMs).toISOString() : cursor?.lastSeenAt,
      state: { count: arr.length },
    };
    return { items, cursor: newCursor };
  },
};
