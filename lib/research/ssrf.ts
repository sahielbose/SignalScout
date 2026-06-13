import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for the research agent's fetch_page tool.
 * Refuses non-http(s) schemes, credentials-in-url, and any host that resolves to
 * a private / loopback / link-local / reserved IP. Resolve-then-check mitigates
 * the common case (note: full DNS-rebinding protection needs fetch-time pinning).
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

function inRange(ip: number, cidrBase: string, bits: number): boolean {
  const base = ipv4ToInt(cidrBase);
  if (base == null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (base & mask);
}

/** True if an IPv4/IPv6 literal is NOT safe to fetch (private/loopback/etc.). */
export function isBlockedAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    const ip = ipv4ToInt(address);
    if (ip == null) return true;
    return (
      inRange(ip, '0.0.0.0', 8) || // "this" network
      inRange(ip, '10.0.0.0', 8) || // private
      inRange(ip, '100.64.0.0', 10) || // CGNAT
      inRange(ip, '127.0.0.0', 8) || // loopback
      inRange(ip, '169.254.0.0', 16) || // link-local (incl. cloud metadata 169.254.169.254)
      inRange(ip, '172.16.0.0', 12) || // private
      inRange(ip, '192.0.0.0', 24) ||
      inRange(ip, '192.168.0.0', 16) || // private
      inRange(ip, '198.18.0.0', 15) || // benchmarking
      inRange(ip, '224.0.0.0', 4) || // multicast
      inRange(ip, '240.0.0.0', 4) // reserved
    );
  }
  if (kind === 6) {
    const a = address.toLowerCase();
    if (a === '::1' || a === '::') return true; // loopback / unspecified
    if (a.startsWith('fe80') || a.startsWith('fc') || a.startsWith('fd')) return true; // link-local / ULA
    if (a.startsWith('::ffff:')) {
      // IPv4-mapped - check the embedded v4
      const v4 = a.slice('::ffff:'.length);
      if (isIP(v4) === 4) return isBlockedAddress(v4);
    }
    return false;
  }
  return true; // not a valid IP literal
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'metadata.google.internal']);

export function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (isIP(h)) return isBlockedAddress(h);
  return false;
}

/** Validate + resolve a URL; throws SsrfError if unsafe. Returns the parsed URL. */
export async function assertSafeUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfError(`invalid url: ${raw}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SsrfError(`blocked scheme: ${u.protocol}`);
  }
  if (u.username || u.password) throw new SsrfError('credentials in url are not allowed');
  if (isBlockedHostname(u.hostname)) throw new SsrfError(`blocked host: ${u.hostname}`);

  // Resolve and verify every resolved address is public.
  let addrs: { address: string }[];
  try {
    addrs = await lookup(u.hostname, { all: true });
  } catch {
    throw new SsrfError(`dns resolution failed: ${u.hostname}`);
  }
  if (addrs.length === 0) throw new SsrfError(`no dns records: ${u.hostname}`);
  for (const { address } of addrs) {
    if (isBlockedAddress(address)) throw new SsrfError(`resolves to private ip: ${address}`);
  }
  return u;
}
