import type { RawItem } from '@/lib/types';
import type { Adapter, AdapterInput, AdapterResult, AdapterCursor } from './types';
import { isNewer } from './types';
import { httpText } from './http';
import { extractMeta } from './html';

/** Pure mapping from a lu.ma event page's meta tags to a RawItem. */
export function mapLumaEvent(url: string, meta: Record<string, string>): RawItem | null {
  const title = meta['og:title'] || meta.title;
  if (!title) return null;
  const description = meta['og:description'] || meta.description || '';
  const site = meta['og:site_name'] || 'lu.ma';
  return {
    source: 'luma',
    externalId: url,
    url,
    publishedAt: new Date().toISOString(),
    actor: { kind: 'company', name: title.slice(0, 80) },
    title,
    text: `Event on ${site}: ${title}.${description ? ` ${description}` : ''}`,
    hintType: 'event',
    meta: { url, site },
  };
}

export const lumaAdapter: Adapter = {
  source: 'luma',
  label: 'lu.ma events',
  intervalSec: 86400,
  async fetch({ key, cursor }: AdapterInput): Promise<AdapterResult> {
    const html = await httpText(key, { accept: 'text/html,*/*' });
    const meta = extractMeta(html);
    const item = mapLumaEvent(key, meta);
    const newCursor: AdapterCursor = {
      lastSeenAt: new Date().toISOString(),
      state: { title: meta['og:title'] },
    };
    if (!item) return { items: [], cursor: newCursor };
    // lu.ma pages are mostly static per event; only emit on first sight.
    const alreadySeen = cursor?.lastExternalId === key;
    return {
      items: alreadySeen ? [] : [item],
      cursor: { ...newCursor, lastExternalId: key },
    };
  },
};
