import type { RawItem } from '@/lib/types';
import type { Adapter, AdapterInput, AdapterResult, AdapterCursor } from './types';
import { httpText } from './http';
import { stripHtml, extractMeta } from './html';
import { contentHash } from '@/lib/hash';

/** Pure: turn fetched HTML into a normalized snapshot (text + hash + title). */
export function snapshotPage(url: string, html: string): { title: string; text: string; hash: string } {
  const meta = extractMeta(html);
  const title = meta['og:title'] || meta.title || url;
  const text = stripHtml(html);
  // hash only the meaningful body text so trivial markup churn doesn't trigger.
  const hash = contentHash(text);
  return { title, text, hash };
}

function hostDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export const webDiffAdapter: Adapter = {
  source: 'web',
  label: 'Web / changelog diff',
  intervalSec: 86400,
  async fetch({ key, cursor }: AdapterInput): Promise<AdapterResult> {
    const html = await httpText(key, { accept: 'text/html,*/*' });
    const snap = snapshotPage(key, html);
    const prevHash = (cursor?.state?.hash as string | undefined) ?? null;
    const changed = prevHash !== snap.hash;
    const newCursor: AdapterCursor = {
      lastSeenAt: new Date().toISOString(),
      state: { hash: snap.hash, title: snap.title },
    };
    if (!changed) return { items: [], cursor: newCursor };

    const domain = hostDomain(key);
    const item: RawItem = {
      source: 'web',
      externalId: `${key}:${snap.hash.slice(0, 12)}`,
      url: key,
      publishedAt: new Date().toISOString(),
      actor: { kind: 'company', name: snap.title.slice(0, 80), domain },
      title: snap.title,
      text:
        `Content change detected on ${domain ?? key}: ${snap.title}.\n` +
        snap.text.slice(0, 1500),
      hintType: 'content',
      meta: { url: key, firstSeen: prevHash === null, hash: snap.hash },
    };
    return { items: [item], cursor: newCursor };
  },
};
