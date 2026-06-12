import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { icps } from '@/lib/db/schema';
import { embedOne } from '@/lib/providers/embed';
import { IcpDefinitionSchema, type IcpDefinition } from '@/lib/types';

/** Flatten an ICP definition into the text we embed for the prefilter. */
export function definitionToText(name: string, def: IcpDefinition): string {
  return [
    name,
    def.industries?.join(' '),
    def.titles?.join(' '),
    def.keywords?.join(' '),
    def.geos?.join(' '),
    def.companySize,
    def.signalTypes?.join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}

export async function createIcp(orgId: string, name: string, definitionInput: unknown) {
  const definition = IcpDefinitionSchema.parse(definitionInput);
  const embedding = await embedOne(definitionToText(name, definition));
  const [row] = await db
    .insert(icps)
    .values({ orgId, name, definition, embedding })
    .returning();
  return row;
}

export async function updateIcp(orgId: string, id: string, name: string, definitionInput: unknown) {
  const definition = IcpDefinitionSchema.parse(definitionInput);
  const embedding = await embedOne(definitionToText(name, definition));
  const [row] = await db
    .update(icps)
    .set({ name, definition, embedding, updatedAt: new Date() })
    .where(and(eq(icps.id, id), eq(icps.orgId, orgId)))
    .returning();
  return row;
}

export async function setIcpActive(orgId: string, id: string, active: boolean) {
  const [row] = await db
    .update(icps)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(icps.id, id), eq(icps.orgId, orgId)))
    .returning();
  return row;
}

export async function deleteIcp(orgId: string, id: string) {
  await db.delete(icps).where(and(eq(icps.id, id), eq(icps.orgId, orgId)));
}

export async function listIcps(orgId: string) {
  return db.select().from(icps).where(eq(icps.orgId, orgId)).orderBy(desc(icps.createdAt));
}

export async function listActiveIcps(orgId?: string) {
  const rows = orgId
    ? await db.select().from(icps).where(and(eq(icps.orgId, orgId), eq(icps.active, true)))
    : await db.select().from(icps).where(eq(icps.active, true));
  return rows;
}
