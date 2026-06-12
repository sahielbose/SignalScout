import { timingSafeEqual } from 'node:crypto';
import { hmacSha256Hex } from '@/lib/hash';

export interface SignedPayload {
  signature: string; // "t=<ms>,v1=<hex>"
  timestamp: number;
}

/** Stripe-style HMAC signature over `${timestamp}.${body}`. */
export function signWebhook(secret: string, body: string, timestamp = Date.now()): SignedPayload {
  const v1 = hmacSha256Hex(secret, `${timestamp}.${body}`);
  return { signature: `t=${timestamp},v1=${v1}`, timestamp };
}

function parseHeader(header: string): { t: number; v1: string } | null {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=').map((s) => s.trim())));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return null;
  return { t, v1: parts.v1 };
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/** Verify a signature header against the raw body. Rejects stale (replay) timestamps. */
export function verifyWebhook(
  secret: string,
  body: string,
  header: string | null | undefined,
  toleranceMs = 5 * 60 * 1000,
): boolean {
  if (!header) return false;
  const parsed = parseHeader(header);
  if (!parsed) return false;
  if (Math.abs(Date.now() - parsed.t) > toleranceMs) return false;
  const expected = hmacSha256Hex(secret, `${parsed.t}.${body}`);
  return safeEqualHex(expected, parsed.v1);
}
