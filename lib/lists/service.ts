import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db/client';
import { lists, listMembers, people, companies } from '@/lib/db/schema';

/**
 * The columns a user can choose to include in a CSV export, in their natural
 * order. `key` is the stable token used in the export URL (`?cols=...`); `label`
 * is the human header written into the file; `value` pulls the cell from a row.
 * Kept here so the picker on the detail page and the export route never drift.
 */
export const LIST_EXPORT_COLUMNS = [
  { key: 'type', label: 'type', value: (m: ListMemberRow) => m.kind },
  { key: 'name', label: 'name', value: (m: ListMemberRow) => m.name },
  { key: 'title', label: 'title', value: (m: ListMemberRow) => m.title },
  { key: 'company', label: 'company', value: (m: ListMemberRow) => m.companyName },
  { key: 'domain', label: 'domain', value: (m: ListMemberRow) => m.domain },
  { key: 'linkedin_url', label: 'linkedin_url', value: (m: ListMemberRow) => m.linkedinUrl },
  { key: 'github_login', label: 'github_login', value: (m: ListMemberRow) => m.githubLogin },
  { key: 'location', label: 'location', value: (m: ListMemberRow) => m.location },
  { key: 'added_at', label: 'added_at', value: (m: ListMemberRow) => m.addedAt.toISOString() },
] as const;

export type ExportColumnKey = (typeof LIST_EXPORT_COLUMNS)[number]['key'];

const EXPORT_COLUMN_KEYS = LIST_EXPORT_COLUMNS.map((c) => c.key) as readonly ExportColumnKey[];

/** Always keep at least the name column so an export is never blank. */
export const DEFAULT_EXPORT_COLUMNS: ExportColumnKey[] = [...EXPORT_COLUMN_KEYS];

/**
 * Validate a requested column list (comma-separated `?cols=` value). Unknown
 * tokens are dropped; order follows the canonical column order; an empty or
 * missing request falls back to every column so a stray link still works.
 */
export function parseExportColumns(raw: string | null | undefined): ExportColumnKey[] {
  if (!raw) return [...DEFAULT_EXPORT_COLUMNS];
  const wanted = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const picked = EXPORT_COLUMN_KEYS.filter((k) => wanted.has(k));
  return picked.length > 0 ? picked : [...DEFAULT_EXPORT_COLUMNS];
}

/** Build the (headers, rows) pair for `toCsv`, honoring the chosen columns. */
export function buildExportTable(
  members: ListMemberRow[],
  cols: ExportColumnKey[],
): { headers: string[]; rows: (string | null)[][] } {
  const chosen = LIST_EXPORT_COLUMNS.filter((c) => cols.includes(c.key));
  const use = chosen.length > 0 ? chosen : LIST_EXPORT_COLUMNS;
  return {
    headers: use.map((c) => c.label),
    rows: members.map((m) => use.map((c) => c.value(m))),
  };
}

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

/** How the index page orders the user's lists. */
export type ListSort = 'recent' | 'name';

export function parseListSort(raw: unknown): ListSort {
  return raw === 'name' ? 'name' : 'recent';
}

export async function listLists(orgId: string, sort: ListSort = 'recent') {
  const orderBy = sort === 'name' ? asc(sql`lower(${lists.name})`) : desc(lists.createdAt);
  return db
    .select({
      id: lists.id,
      name: lists.name,
      createdAt: lists.createdAt,
      members: sql<number>`(select count(*)::int from ${listMembers} m where m.list_id = ${lists.id})`,
    })
    .from(lists)
    .where(eq(lists.orgId, orgId))
    .orderBy(orderBy);
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

/** Which kinds of saved entries to show on the detail page. */
export type MemberKindFilter = 'all' | 'person' | 'company';
/** How the detail page orders saved entries. */
export type MemberSort = 'recent' | 'name';

export function parseMemberKind(raw: unknown): MemberKindFilter {
  return raw === 'person' || raw === 'company' ? raw : 'all';
}

export function parseMemberSort(raw: unknown): MemberSort {
  return raw === 'name' ? 'name' : 'recent';
}

export interface MemberQueryOptions {
  kind?: MemberKindFilter;
  sort?: MemberSort;
}

export async function getListMembers(
  orgId: string,
  listId: string,
  opts: MemberQueryOptions = {},
): Promise<ListMemberRow[]> {
  if (!(await assertOwns(orgId, listId))) return [];
  const kind = opts.kind ?? 'all';
  const sort = opts.sort ?? 'recent';
  const personCompany = alias(companies, 'person_company');

  // The kind filter is applied in SQL so we never ship rows we will not show.
  const where =
    kind === 'person'
      ? and(eq(listMembers.listId, listId), sql`${listMembers.personId} is not null`)
      : kind === 'company'
        ? and(eq(listMembers.listId, listId), sql`${listMembers.companyId} is not null`)
        : eq(listMembers.listId, listId);

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
    .where(where)
    .orderBy(desc(listMembers.addedAt));

  const mapped = rows.map((r): ListMemberRow => {
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

  // "Name" sorts across both kinds (the display name lives in different tables),
  // so do it after mapping. "Recent" already comes ordered from SQL.
  if (sort === 'name') {
    mapped.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }
  return mapped;
}
