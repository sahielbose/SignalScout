'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/auth/session';
import {
  createList,
  deleteList,
  updateList,
  removeMember,
  addCompanyToList,
  addPersonToList,
  ensureDefaultList,
  listLists,
} from './service';

export async function createListAction(form: FormData) {
  const orgId = await requireOrgId();
  const name = String(form.get('name') ?? '').trim();
  if (name) await createList(orgId, name);
  revalidatePath('/lists');
}

export async function deleteListAction(form: FormData) {
  const orgId = await requireOrgId();
  const id = String(form.get('id') ?? '');
  if (id) await deleteList(orgId, id);
  revalidatePath('/lists');
}

export async function renameListAction(form: FormData) {
  const orgId = await requireOrgId();
  const id = String(form.get('id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  if (id && name) await updateList(orgId, id, name);
  revalidatePath(`/lists/${id}`);
  revalidatePath('/lists');
}

export async function removeMemberAction(form: FormData) {
  const orgId = await requireOrgId();
  const listId = String(form.get('listId') ?? '');
  const memberId = String(form.get('memberId') ?? '');
  if (listId && memberId) await removeMember(orgId, listId, memberId);
  revalidatePath(`/lists/${listId}`);
}

export interface AddResult {
  ok: boolean;
  error?: string;
}

/** Used by the feed/research "Add to list" menu. */
export async function addToListAction(input: {
  listId?: string;
  newListName?: string;
  kind: 'person' | 'company';
  entityId: string;
}): Promise<AddResult> {
  try {
    const orgId = await requireOrgId();
    let listId = input.listId;
    if (!listId && input.newListName?.trim()) {
      const row = await createList(orgId, input.newListName.trim());
      listId = row!.id;
    }
    if (!listId) listId = await ensureDefaultList(orgId);

    const ok =
      input.kind === 'person'
        ? await addPersonToList(orgId, listId, input.entityId)
        : await addCompanyToList(orgId, listId, input.entityId);
    revalidatePath('/lists');
    return { ok };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getListsForPicker(): Promise<{ id: string; name: string }[]> {
  const orgId = await requireOrgId();
  const rows = await listLists(orgId);
  return rows.map((r) => ({ id: r.id, name: r.name }));
}
