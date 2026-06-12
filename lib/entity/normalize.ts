import { parse } from 'tldts';

/** Registrable domain (public-suffix aware). "sub.stripe.com" / a URL / an email → "stripe.com". */
export function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;
  if (s.includes('@')) s = s.split('@')[1] ?? s;
  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  s = s.split('/')[0] ?? s;
  try {
    const { domain } = parse(s);
    return domain ? domain.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Lowercase, strip accents + punctuation, collapse whitespace. */
export function normalizeName(n?: string | null): string {
  if (!n) return '';
  return n
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMPANY_SUFFIXES =
  /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|gmbh|ag|sa|s\.a|plc|holdings|group|labs|technologies|technology|software|systems)\b/g;

/** Normalized company key for de-duplication when no domain is present. */
export function normalizeCompanyName(n?: string | null): string {
  const base = normalizeName(n);
  const stripped = base.replace(COMPANY_SUFFIXES, ' ').replace(/\s+/g, ' ').trim();
  return stripped || base;
}

/** Validate a LinkedIn profile URL and canonicalize to a comparable strong key. */
export function normalizeLinkedinUrl(input?: string | null): string | null {
  if (!input) return null;
  try {
    const u = new URL(input.includes('://') ? input : `https://${input}`);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/in\/([^/]+)/i);
    if (!m) return null;
    return `https://www.linkedin.com/in/${decodeURIComponent(m[1]!).toLowerCase()}`;
  } catch {
    return null;
  }
}

export function normalizeEmail(input?: string | null): string | null {
  if (!input) return null;
  const e = input.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}
