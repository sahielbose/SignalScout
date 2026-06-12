import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sourceCursors } from '@/lib/db/schema';
import type { AdapterCursor } from './types';

export async function readCursor(source: string, key: string): Promise<AdapterCursor | null> {
  const [row] = await db
    .select()
    .from(sourceCursors)
    .where(and(eq(sourceCursors.source, source), eq(sourceCursors.key, key)))
    .limit(1);
  if (!row) return null;
  return {
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    lastExternalId: row.lastExternalId,
    state: row.state,
  };
}

export async function writeCursor(source: string, key: string, cursor: AdapterCursor): Promise<void> {
  await db
    .insert(sourceCursors)
    .values({
      source,
      key,
      lastSeenAt: cursor.lastSeenAt ? new Date(cursor.lastSeenAt) : null,
      lastExternalId: cursor.lastExternalId ?? null,
      state: cursor.state ?? {},
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [sourceCursors.source, sourceCursors.key],
      set: {
        lastSeenAt: cursor.lastSeenAt ? new Date(cursor.lastSeenAt) : null,
        lastExternalId: cursor.lastExternalId ?? null,
        state: cursor.state ?? {},
        updatedAt: new Date(),
      },
    });
}
