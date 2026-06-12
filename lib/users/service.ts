import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

/** Bring-your-own LLM key (per user). Stored as-is in dev; encrypt at rest in prod. */
export async function getByoKey(userId: string): Promise<string | null> {
  const [u] = await db.select({ key: users.byoLlmKey }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.key ?? null;
}

export async function setByoKey(userId: string, key: string | null): Promise<void> {
  await db.update(users).set({ byoLlmKey: key && key.trim() ? key.trim() : null }).where(eq(users.id, userId));
}
