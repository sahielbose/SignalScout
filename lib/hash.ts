import { createHash, createHmac } from 'node:crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Stable content hash for dedupe - order-independent join of parts. */
export function contentHash(...parts: (string | null | undefined)[]): string {
  return sha256Hex(parts.map((p) => (p ?? '').trim()).join(''));
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}
