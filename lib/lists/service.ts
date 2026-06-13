import { and, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import { lists, listMembers, people, companies } from '@/lib/db/schema';

export async function createList(orgId: string, name: string) {
  const [row] = await db.insert(lists).values({ orgId, name: name.trim() || 'Untitled list' }).returning();
  return row;
}

export async function deleteList(orgId: string, id: string) {
  await db.delete(lists).where(and(eq(lists.id, id), eq(lists.orgId, orgId)));
}

export async function updateList(orgId: string, id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const [row] = await db
    .update(lists)
    .set({ name: trimmed })
    .where(and(eq(lists.id, id), eq(lists.orgId, orgId)))
    .returning();
  return row ?? null;
}

export async function getList(orgId: string, id: string) {
  const [row] = await db.select().from(lists).where(and(eq(lists.id, id), eq(lists.orgId, orgId))).limit(1);
  return row ?? null;
}

export async function listLists(orgId: string) {
  return db
    .select({
      id: lists.id,
      name: lists.name,
      createdAt: lists.createdAt,
      members: sql<number>`(select count(*)::int from ${listMembers} m where m.list_id = ${lists.id})`,
    })
    .from(lists)
    .where(eq(lists.orgId, orgId))
    .orderBy(desc(lists.createdAt));
}

async function assertOwns(orgId: string, listId: string): Promise<boolean> {
  const l = await getList(orgId, listId);
  return !!l;
}

export async function addPersonToList(orgId: string, listId: string, personId: string): Promise<boolean> {
  if (!(await assertOwns(orgId, listId))) return false;
  await db.insert(listMembers).values({ listId, personId }).onConflictDoNothing();
  return true;
}

export async function addCompanyToList(orgId: string, listId: string, companyId: string): Promise<boolean> {
  if (!(await assertOwns(orgId, listId))) return false;
  await db.insert(listMembers).values({ listId, companyId }).onConflictDoNothing();
  return true;
}

export async function removeMember(orgId: string, listId: string, memberId: string): Promise<void> {
  if (!(await assertOwns(orgId, listId))) return;
  await db.delete(listMembers).where(and(eq(listMembers.id, memberId), eq(listMembers.listId, listId)));
}

/** A per-org "Saved" list for one-click feed adds. */
export async function ensureDefaultList(orgId: string): Promise<string> {
  const [existing] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.orgId, orgId), eq(lists.name, 'Saved')))
    .limit(1);
  if (existing) return existing.id;
  const row = await createList(orgId, 'Saved');
  return row!.id;
}

export interface ListMemberRow {
  memberId: string;
  kind: 'person' | 'company';
  entityId: string;
  name: string;
  title: string | null;
  companyName: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  githubLogin: string | null;
  location: string | null;
  addedAt: Date;
}

export async function getListMembers(orgId: string, listId: string): Promise<ListMemberRow[]> {
  if (!(await assertOwns(orgId, listId))) return [];
  const personCompany = alias(companies, 'person_company');

  const rows = await db
    .select({
      memberId: listMembers.id,
      addedAt: listMembers.addedAt,
      personId: listMembers.personId,
      companyId: listMembers.companyId,
      pFullName: people.fullName,
      pTitle: people.title,
      pLinkedin: people.linkedinUrl,
      pGithub: people.githubLogin,
      pLocation: people.location,
      pCompanyName: personCompany.name,
      pCompanyDomain: personCompany.domain,
      cName: companies.name,
      cDomain: companies.domain,
    })
    .from(listMembers)
    .leftJoin(people, eq(listMembers.personId, people.id))
    .leftJoin(personCompany, eq(people.companyId, personCompany.id))
    .leftJoin(companies, eq(listMembers.companyId, companies.id))
    .where(eq(listMembers.listId, listId))
    .orderBy(desc(listMembers.addedAt));

  return rows.map((r): ListMemberRow => {
    if (r.personId) {
      return {
        memberId: r.memberId,
        kind: 'person',
        entityId: r.personId,
        name: r.pFullName ?? 'Unknown',
        title: r.pTitle ?? null,
        companyName: r.pCompanyName ?? null,
        domain: r.pCompanyDomain ?? null,
        linkedinUrl: r.pLinkedin ?? null,
        githubLogin: r.pGithub ?? null,
        location: r.pLocation ?? null,
        addedAt: r.addedAt,
      };
    }
    return {
      memberId: r.memberId,
      kind: 'company',
      entityId: r.companyId!,
      name: r.cName ?? r.cDomain ?? 'Unknown company',
      title: null,
      companyName: r.cName ?? null,
      domain: r.cDomain ?? null,
      linkedinUrl: null,
      githubLogin: null,
      location: null,
      addedAt: r.addedAt,
    };
  });
}
