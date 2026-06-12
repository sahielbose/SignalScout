/** Minimal, dependency-free HTML helpers for web-diff + lu.ma adapters. */

const TAG_RE = /<\/?[^>]+>/g;
const SCRIPT_STYLE_RE = /<(script|style|noscript)[\s\S]*?<\/\1>/gi;
const WS_RE = /\s+/g;

/**
 * Strip scripts/styles/tags and collapse whitespace to plain text.
 * Decodes entities FIRST so entity-encoded markup (e.g. Greenhouse returns
 * `&lt;h2&gt;…`) is treated as tags and removed, not left as literal text.
 */
export function stripHtml(html: string): string {
  const decoded = decodeEntities(html);
  return decodeEntities(
    decoded
      .replace(SCRIPT_STYLE_RE, ' ')
      .replace(TAG_RE, ' ')
      .replace(WS_RE, ' ')
      .trim(),
  );
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** Pull <meta property="og:*"> / <meta name="*"> and <title>. */
export function extractMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) out.title = decodeEntities(title[1].trim());
  const metaRe = /<meta\s+([^>]+?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html))) {
    const attrs = m[1] ?? '';
    const key =
      attrs.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? null;
    const content = attrs.match(/content\s*=\s*["']([\s\S]*?)["']/i)?.[1] ?? null;
    if (key && content != null) out[key] = decodeEntities(content.trim());
  }
  return out;
}

/** Extract a Next.js __NEXT_DATA__ JSON blob if present (lu.ma, many SPAs). */
export function extractNextData(html: string): unknown | null {
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
