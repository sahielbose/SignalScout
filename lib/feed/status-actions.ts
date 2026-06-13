'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireOrgId } from '@/lib/auth/session';
import { setSignalStatus, clearSignalStatus } from './status';

const SignalIdSchema = z.string().uuid();

export interface StatusActionResult {
  ok: boolean;
  error?: string;
}

function ok(): StatusActionResult {
  return { ok: true };
}

function fail(err: unknown): StatusActionResult {
  return { ok: false, error: err instanceof Error ? err.message : 'Action failed' };
}

export async function dismissSignalAction(signalId: string): Promise<StatusActionResult> {
  try {
    const orgId = await requireOrgId();
    const id = SignalIdSchema.parse(signalId);
    await setSignalStatus(orgId, id, 'dismissed');
    revalidatePath('/feed');
    return ok();
  } catch (err) {
    return fail(err);
  }
}

export async function snoozeSignalAction(signalId: string, days: number): Promise<StatusActionResult> {
  try {
    const orgId = await requireOrgId();
    const id = SignalIdSchema.parse(signalId);
    const d = z.number().int().min(1).max(365).parse(days);
    const until = new Date(Date.now() + d * 86400_000);
    await setSignalStatus(orgId, id, 'snoozed', until);
    revalidatePath('/feed');
    return ok();
  } catch (err) {
    return fail(err);
  }
}

export async function markActionedAction(signalId: string): Promise<StatusActionResult> {
  try {
    const orgId = await requireOrgId();
    const id = SignalIdSchema.parse(signalId);
    await setSignalStatus(orgId, id, 'actioned');
    revalidatePath('/feed');
    return ok();
  } catch (err) {
    return fail(err);
  }
}

export async function reopenSignalAction(signalId: string): Promise<StatusActionResult> {
  try {
    const orgId = await requireOrgId();
    const id = SignalIdSchema.parse(signalId);
    await clearSignalStatus(orgId, id);
    revalidatePath('/feed');
    return ok();
  } catch (err) {
    return fail(err);
  }
}
