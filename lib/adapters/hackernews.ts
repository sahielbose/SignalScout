import type { RawItem } from '@/lib/types';
import type { Adapter, AdapterInput, AdapterResult, AdapterCursor } from './types';
import { isNewer } from './types';
import { httpJson } from './http';

/** One hit from the Algolia Hacker News Search API. */
export interface HnHit {
  objectID: string;
  title?: string | null;
  url?: string | null;
  author?: string | null;
  story_text?: string | null;
  points?: number | null;
  num_comments?: number | null;
  created_at?: string | null;
  created_at_i?: number | null;
}

export interface HnResponse {
  hits: HnHit[];
}

/**
 * Derive a readable actor name from a "Show HN: ..." style title.
 * "Show HN: Acme - a faster build tool" -> "Acme"
 */
export function deriveHnActor(title: string): string {
  let t = title.trim();
  // Strip the leading "Show HN:" / "Ask HN:" / "Tell HN:" prefix.
  t = t.replace(/^(show|ask|tell)\s+hn[:\s-]*/i, '').trim();
  // The product/company is usually the first clause before a separator.
  const head = t.split(/\s[---:|]\s|[---:|]/)[0]?.trim();
  const name = (head || t).slice(0, 80).trim();
  return name || 'Hacker News';
}

/** Pure mapping - unit-tested with fixtures. */
export function mapHnHit(hit: HnHit): RawItem {
  const objectId = hit.objectID;
  const title = (hit.title ?? '').trim();
  const url = hit.url || `https://news.ycombinator.com/item?id=${objectId}`;
  const isShowHn = /^show\s+hn/i.test(title);
  const storyText = (hit.story_text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const text = [title, storyText].filter(Boolean).join('\n').slice(0, 1500);
  return {
    source: 'hackernews',
    externalId: objectId,
    url,
    publishedAt: hit.created_at ?? undefined,
    actor: {
      kind: 'company',
      name: deriveHnActor(title),
    },
    title: title || undefined,
    text: text || title || `Hacker News story ${objectId}`,
    hintType: isShowHn ? 'product_launch' : undefined,
    meta: {
      objectId,
      author: hit.author ?? undefined,
      points: hit.points ?? undefined,
      numComments: hit.num_comments ?? undefined,
      createdAtI: hit.created_at_i ?? undefined,
    },
  };
}

/**
 * Hacker News adapter backed by the free Algolia HN Search API (no auth).
 * `key` selects the feed: a tag like "show_hn" / "story", or a free-text query
 * is supported via the `query=` parameter (anything other than the known tags).
 */
export const hackernewsAdapter: Adapter = {
  source: 'hackernews',
  label: 'Hacker News',
  intervalSec: 1800,
  async fetch({ key, cursor, limit, signal }: AdapterInput): Promise<AdapterResult> {
    const hitsPerPage = Math.min(Math.max(limit ?? 20, 1), 100);
    const params = new URLSearchParams();
    const knownTags = new Set(['show_hn', 'ask_hn', 'story', 'front_page', 'poll']);
    const trimmed = (key || 'show_hn').trim();
    if (knownTags.has(trimmed)) {
      params.set('tags', trimmed);
    } else {
      // Treat the key as a free-text search query over stories.
      params.set('tags', 'story');
      params.set('query', trimmed);
    }
    params.set('hitsPerPage', String(hitsPerPage));
    // Only ask for items newer than the cursor when we have a numeric timestamp.
    const sinceI = typeof cursor?.state?.createdAtI === 'number' ? (cursor.state.createdAtI as number) : undefined;
    if (sinceI) params.set('numericFilters', `created_at_i>${sinceI}`);

    const url = `https://hn.algolia.com/api/v1/search_by_date?${params.toString()}`;
    const res = await httpJson<HnResponse>(url, { signal });
    const hits = Array.isArray(res.hits) ? res.hits : [];

    const fresh = hits.filter((h) => isNewer(h.created_at ?? undefined, cursor));
    const items = fresh.map(mapHnHit);

    const newestAt = hits.reduce<string | undefined>((max, h) => {
      const t = h.created_at ?? undefined;
      return t && (!max || t > max) ? t : max;
    }, cursor?.lastSeenAt ?? undefined);
    const newestI = hits.reduce<number | undefined>((max, h) => {
      const t = h.created_at_i ?? undefined;
      return typeof t === 'number' && (max === undefined || t > max) ? t : max;
    }, sinceI);

    const newCursor: AdapterCursor = {
      lastSeenAt: newestAt,
      lastExternalId: items[0]?.externalId ?? cursor?.lastExternalId ?? null,
      state: { createdAtI: newestI, count: hits.length },
    };
    return { items, cursor: newCursor };
  },
};
