'use server';

import { requireOrgId } from '@/lib/auth/session';
import { auth } from '@/lib/auth';
import { parseFeedFilters } from '@/lib/feed/queries';
import { summarizeFeed, summarizeCompanies, summarizeList, type SummaryResult } from './service';

async function currentUserId(): Promise<string | null> {
  const s = await auth();
  return s?.user?.id ?? null;
}

/**
 * Summarize the feed cards in the user's current view. `search` is the feed's
 * current URL query string (so the summary respects the active filters).
 */
export async function summarizeFeedAction(search: string): Promise<SummaryResult> {
  const orgId = await requireOrgId();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Not signed in.' };
  const filters = parseFeedFilters(new URLSearchParams(search ?? ''));
  return summarizeFeed(orgId, userId, filters);
}

/**
 * Summarize the companies in the user's current view. `search` is the companies
 * page query string, so the digest respects the active filters (search, type,
 * minimum signals).
 */
export async function summarizeCompaniesAction(search = ''): Promise<SummaryResult> {
  const orgId = await requireOrgId();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Not signed in.' };
  const p = new URLSearchParams(search);
  const min = Number(p.get('minSignals'));
  return summarizeCompanies(orgId, userId, {
    search: p.get('search') || undefined,
    type: p.get('type') || undefined,
    minSignals: Number.isFinite(min) && min > 1 ? Math.floor(min) : undefined,
  });
}

/** Summarize the people and companies saved into one list. */
export async function summarizeListAction(listId: string): Promise<SummaryResult> {
  const orgId = await requireOrgId();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Not signed in.' };
  return summarizeList(orgId, userId, listId);
}
