'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/auth/session';
import { SignalTypeSchema, type IcpDefinition, type SignalType } from '@/lib/types';
import { createIcp, updateIcp, deleteIcp, setIcpActive } from './service';

function parseList(v: FormDataEntryValue | null): string[] {
  if (typeof v !== 'string') return [];
  return v
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function definitionFromForm(form: FormData): IcpDefinition {
  const signalTypes = form
    .getAll('signalTypes')
    .map((s) => String(s))
    .filter((s): s is SignalType => SignalTypeSchema.safeParse(s).success);
  const threshold = Number(form.get('notifyThreshold') ?? 0.7);
  return {
    industries: parseList(form.get('industries')),
    titles: parseList(form.get('titles')),
    companySize: (form.get('companySize') as string) || undefined,
    keywords: parseList(form.get('keywords')),
    geos: parseList(form.get('geos')),
    signalTypes,
    notify: {
      email: form.get('notifyEmail') === 'on',
      slack: form.get('notifySlack') === 'on',
    },
    notifyThreshold: Number.isFinite(threshold) ? Math.max(0, Math.min(1, threshold)) : 0.7,
  };
}

export async function createIcpAction(form: FormData) {
  const orgId = await requireOrgId();
  const name = String(form.get('name') ?? '').trim();
  if (!name) return;
  await createIcp(orgId, name, definitionFromForm(form));
  revalidatePath('/icps');
}

export async function updateIcpAction(form: FormData) {
  const orgId = await requireOrgId();
  const id = String(form.get('id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  if (!id || !name) return;
  await updateIcp(orgId, id, name, definitionFromForm(form));
  revalidatePath('/icps');
}

export async function deleteIcpAction(form: FormData) {
  const orgId = await requireOrgId();
  const id = String(form.get('id') ?? '');
  if (id) await deleteIcp(orgId, id);
  revalidatePath('/icps');
}

export async function toggleIcpAction(form: FormData) {
  const orgId = await requireOrgId();
  const id = String(form.get('id') ?? '');
  const active = form.get('active') === 'true';
  if (id) await setIcpActive(orgId, id, !active);
  revalidatePath('/icps');
}
