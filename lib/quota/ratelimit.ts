import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { rateLimits } from '@/lib/db/schema';

export interface RateLimitOpts {
  capacity: number; // bucket size (burst)
  refillPerSec: number; // tokens added per second
  cost?: number; // tokens this request costs
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Postgres-backed token bucket (no external rate-limit dependency).
 * Atomic via SELECT ... FOR UPDATE inside a transaction.
 */
export async function rateLimit(key: string, opts: RateLimitOpts): Promise<RateLimitResult> {
  const cost = opts.cost ?? 1;
  const now = Date.now();
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1).for('update');
      let tokens = opts.capacity;
      if (row) {
        const elapsed = Math.max(0, (now - row.updatedAt.getTime()) / 1000);
        tokens = Math.min(opts.capacity, row.tokens + elapsed * opts.refillPerSec);
      }
      const allowed = tokens >= cost;
      const newTokens = allowed ? tokens - cost : tokens;
      await tx
        .insert(rateLimits)
        .values({ key, tokens: newTokens, updatedAt: new Date(now) })
        .onConflictDoUpdate({ target: rateLimits.key, set: { tokens: newTokens, updatedAt: new Date(now) } });
      return { allowed, remaining: Math.floor(newTokens) };
    });
  } catch {
    // fail open on infra errors - never hard-break the app on the limiter
    return { allowed: true, remaining: opts.capacity };
  }
}

/** Pull a client IP from common proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
