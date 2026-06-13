import type { RawItem } from '@/lib/types';
import type { Adapter, AdapterInput, AdapterResult, AdapterCursor } from './types';
import { isNewer } from './types';
import { httpText } from './http';

const PH_FEED_URL = 'https://www.producthunt.com/feed';

/** A parsed feed entry (works for both RSS <item> and Atom <entry>). */
export interface FeedEntry {
  title?: string;
  link?: string;
  description?: string;
  guid?: string;
  publishedAt?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Strip CDATA wrappers, HTML tags, and collapse whitespace. */
function cleanText(raw: string | undefined): string {
  if (!raw) return '';
  let s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = decodeEntities(s);
  s = s.replace(/<[^>]+>/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function firstTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : undefined;
}

/** Atom links carry the URL in an href attribute; RSS puts it in the body. */
function extractLink(block: string): string | undefined {
  // Prefer an Atom alternate link, else the first link href, else <link>body</link>.
  const alt = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (alt?.[1]) return alt[1];
  const href = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (href?.[1]) return href[1];
  const body = firstTag(block, 'link');
  if (body) return cleanText(body);
  return undefined;
}

/**
 * Robust, dependency-free parser for RSS 2.0 and Atom feeds.
 * Tolerates missing fields and either element naming scheme.
 */
export function parseFeed(xml: string): FeedEntry[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi) ?? [];
  const out: FeedEntry[] = [];
  for (const block of blocks) {
    const title = cleanText(firstTag(block, 'title'));
    const link = extractLink(block);
    const guid = cleanText(firstTag(block, 'guid') ?? firstTag(block, 'id'));
    const description = cleanText(
      firstTag(block, 'description') ?? firstTag(block, 'content') ?? firstTag(block, 'summary'),
    );
    const rawDate = firstTag(block, 'pubDate') ?? firstTag(block, 'published') ?? firstTag(block, 'updated');
    let publishedAt: string | undefined;
    if (rawDate) {
      const d = new Date(cleanText(rawDate));
      if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    }
    out.push({ title, link, description, guid, publishedAt });
  }
  return out;
}

/** Derive a company/product name from a Product Hunt entry title. */
export function derivePhActor(title: string): string {
  // Titles look like "ProductName" or "ProductName - tagline".
  const head = title.split(/\s[---:|]\s|[---:|]/)[0]?.trim();
  const name = (head || title).slice(0, 80).trim();
  return name || 'Product Hunt';
}

/** Pure mapping - unit-tested with fixtures. */
export function mapPhEntry(entry: FeedEntry): RawItem | null {
  const title = (entry.title ?? '').trim();
  const url = entry.link || entry.guid;
  if (!url) return null;
  const externalId = entry.link || entry.guid || url;
  const description = entry.description ?? '';
  const text = [title, description].filter(Boolean).join('\n').slice(0, 1500);
  return {
    source: 'producthunt',
    externalId,
    url,
    publishedAt: entry.publishedAt,
    actor: {
      kind: 'company',
      name: derivePhActor(title),
    },
    title: title || undefined,
    text: text || title || 'Product Hunt launch',
    hintType: 'product_launch',
    meta: { guid: entry.guid },
  };
}

/**
 * Product Hunt adapter backed by the PUBLIC RSS/Atom feed (no auth, no key).
 * `key` is accepted for interface symmetry (e.g. "feed") but ignored.
 */
export const producthuntAdapter: Adapter = {
  source: 'producthunt',
  label: 'Product Hunt',
  intervalSec: 3600,
  async fetch({ cursor, signal }: AdapterInput): Promise<AdapterResult> {
    const xml = await httpText(PH_FEED_URL, { accept: 'application/atom+xml,application/rss+xml,text/xml,*/*', signal });
    const entries = parseFeed(xml);

    const items = entries
      .map(mapPhEntry)
      .filter((i): i is RawItem => i !== null)
      .filter((i) => isNewer(i.publishedAt, cursor));

    const newestAt = entries.reduce<string | undefined>((max, e) => {
      const t = e.publishedAt;
      return t && (!max || t > max) ? t : max;
    }, cursor?.lastSeenAt ?? undefined);

    const newCursor: AdapterCursor = {
      lastSeenAt: newestAt,
      lastExternalId: items[0]?.externalId ?? cursor?.lastExternalId ?? null,
      state: { count: entries.length },
    };
    return { items, cursor: newCursor };
  },
};
