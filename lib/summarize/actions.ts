'use server';

import { requireOrgId } from '@/lib/auth/session';
import { auth } from '@/lib/auth';
import { parseFeedFilters } from '@/lib/feed/queries';
import { summarizeFeed, type SummaryResult } from './service';

/**
 * Summarize the feed cards in the user's current view. `search` is the feed's
 * current URL query string (so the summary respects the active filters).
 */
export async function summarizeFeedAction(search: string): Promise<SummaryResult> {
  const orgId = await requireOrgId();
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: 'Not signed in.' };
  const filters = parseFeedFilters(new URLSearchParams(search ?? ''));
  return summarizeFeed(orgId, s.user.id, filters);
}
