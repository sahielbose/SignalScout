import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { apiKeys } from '@/lib/db/schema';
import { sha256Hex } from '@/lib/hash';

const PREFIX = 'ssk_live_';

export interface CreatedKey {
  id: string;
  name: string;
  prefix: string;
  /** full plaintext key - shown exactly once, never stored */
  key: string;
}

export async function createApiKey(orgId: string, name: string): Promise<CreatedKey> {
  const secret = randomBytes(24).toString('base64url');
  const key = `${PREFIX}${secret}`;
  const prefix = `${PREFIX}${secret.slice(0, 6)}`;
  const keyHash = sha256Hex(key);
  const [row] = await db
    .insert(apiKeys)
    .values({ orgId, name: name.trim() || 'API key', prefix, keyHash, scopes: ['read', 'research'] })
    .returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix });
  return { id: row!.id, name: row!.name, prefix: row!.prefix, key };
}

export interface VerifiedKey {
  orgId: string;
  keyId: string;
}

/** Verify a raw bearer key by hash. Returns the org or null. Updates last_used_at. */
export async function verifyApiKey(raw: string | null | undefined): Promise<VerifiedKey | null> {
  if (!raw || !raw.startsWith(PREFIX)) return null;
  const keyHash = sha256Hex(raw.trim());
  const [row] = await db
    .select({ id: apiKeys.id, orgId: apiKeys.orgId, revokedAt: apiKeys.revokedAt })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);
  if (!row || row.revokedAt) return null;
  // fire-and-forget last-used update
  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return { orgId: row.orgId, keyId: row.id };
}

export async function listApiKeys(orgId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.orgId, orgId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(orgId: string, id: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)));
}
