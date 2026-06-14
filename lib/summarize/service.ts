import { generateText } from 'ai';
import { getModel, modelId, logLlmRun, type LlmRunRecord } from '@/lib/providers/llm';
import { hasLLM } from '@/lib/env';
import { getByoKey } from '@/lib/users/service';
import { enforceQuota, QuotaError } from '@/lib/quota/service';
import { getFeed, type FeedFilters, type FeedItem } from '@/lib/feed/queries';
import { listCompaniesWithCounts } from '@/lib/companies/queries';
import { getListMembers, getList } from '@/lib/lists/service';
import { stripDashes, relativeTime } from '@/lib/utils';

export interface SummaryResult {
  ok: boolean;
  summary?: string;
  count?: number;
  /** True when the user's own AI key powered this (instead of the shared key). */
  usingOwnKey?: boolean;
  error?: string;
}

const MAX_CARDS = 30;

/**
 * Shared core: given a set of plain-text card lines, write a short digest. Handles
 * the user's own AI key (so spend routes to them and bypasses the shared quota),
 * the shared key, and a deterministic no-key fallback. Always org-scoped by the
 * caller, which builds `lines` only from data it already fetched org-scoped.
 */
async function runSummary(
  orgId: string,
  userId: string,
  input: { lines: string[]; count: number; system: string; fallback: string; noun: string },
): Promise<SummaryResult> {
  const { lines, count, system, fallback, noun } = input;
  if (count === 0) {
    return { ok: true, summary: `There is nothing in this view to summarize yet.`, count: 0, usingOwnKey: false };
  }

  const byoKey = await getByoKey(userId);
  const model = hasLLM() || byoKey ? getModel('research', byoKey) : null;

  // No model available: return the deterministic fallback and DO NOT spend a
  // quota credit (it makes no model call and costs nothing).
  if (!model) return { ok: true, summary: fallback, count, usingOwnKey: !!byoKey };

  // Only a real model call counts against quota.
  try {
    await enforceQuota(orgId, 'research', { byoKey: !!byoKey });
  } catch (err) {
    // Speak in the user's terms ("Summarize"), not the internal quota kind.
    const friendly =
      err instanceof QuotaError
        ? "You have reached today's AI limit. Add your own AI key on the Usage page to keep going, or try again tomorrow."
        : (err as Error).message;
    return { ok: false, error: friendly };
  }

  try {
    const t0 = Date.now();
    const { text, usage } = await generateText({
      model,
      temperature: 0.3,
      maxRetries: 1,
      system:
        system +
        ' Keep it under 180 words. Write plain prose with NO markdown: no asterisks, no hash headers, no bullet characters.' +
        ' Use no em dashes and no emoji.',
      prompt: `Summarize these ${count} ${noun}:\n\n${lines.join('\n')}`,
    });
    await logLlmRun({
      orgId,
      kind: 'summarize' as LlmRunRecord['kind'],
      model: modelId('research'),
      input: { count },
      output: { len: text.length },
      inputTokens: usage?.promptTokens,
      outputTokens: usage?.completionTokens,
      latencyMs: Date.now() - t0,
    }).catch(() => {});
    const clean = stripDashes(
      text
        .trim()
        .replace(/\*\*/g, '')
        .replace(/(^|\n)#{1,6}\s*/g, '$1'),
    );
    return { ok: true, summary: clean, count, usingOwnKey: !!byoKey };
  } catch {
    return { ok: true, summary: fallback, count, usingOwnKey: !!byoKey };
  }
}

const SALES_SYSTEM =
  'You are a concise B2B sales assistant. Summarize a feed of public buying signals for a salesperson in plain English.' +
  ' Group by theme, call out the 3 to 5 most promising opportunities and why, and end with one line on where to focus first.';

function describeFeed(items: FeedItem[]): string[] {
  return items.map((s, i) => {
    const who = s.companyName ?? s.personName ?? 'Unknown';
    const what = (s.title ?? s.summary ?? '').replace(/\s+/g, ' ').slice(0, 160);
    const str = Math.round((s.strength ?? 0) * 100);
    return `${i + 1}. [${(s.type ?? 'signal').replace(/_/g, ' ')}] ${who}: ${what} (strength ${str}%)`;
  });
}

/** No-key fallback for the feed so the tool always returns something useful. */
function feedFallback(items: FeedItem[]): string {
  const byType = new Map<string, number>();
  for (const s of items) {
    const t = (s.type ?? 'other').replace(/_/g, ' ');
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  const parts = [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}`);
  const strongest = [...items]
    .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
    .slice(0, 3)
    .map((s) => s.companyName ?? s.personName ?? 'Unknown');
  return `Across ${items.length} signals: ${parts.join(', ')}. The strongest buying signs right now are ${strongest.join(
    ', ',
  )}. Add your own AI key on the Usage page for a smarter written summary.`;
}

/** Read the cards in the user's current feed view and write a short digest. */
export async function summarizeFeed(orgId: string, userId: string, filters: FeedFilters): Promise<SummaryResult> {
  const { items } = await getFeed(orgId, filters, 0);
  const top = items.slice(0, MAX_CARDS);
  return runSummary(orgId, userId, {
    lines: describeFeed(top),
    count: top.length,
    noun: 'signals',
    system: SALES_SYSTEM,
    fallback: feedFallback(top),
  });
}

/**
 * Summarize the companies in the user's current companies view. The optional
 * filters (search, type, minSignals) mirror the companies page so the digest
 * matches the rows actually on screen, not the whole org.
 */
export async function summarizeCompanies(
  orgId: string,
  userId: string,
  filters: { search?: string; type?: string; minSignals?: number } = {},
): Promise<SummaryResult> {
  const rows = await listCompaniesWithCounts(orgId, {
    sort: 'signals',
    limit: MAX_CARDS,
    search: filters.search,
    type: filters.type,
    minSignals: filters.minSignals,
  });
  const lines = rows.map((c, i) => {
    const name = c.name ?? c.domain ?? 'Unknown';
    const last = c.lastAt ? relativeTime(c.lastAt) : 'unknown';
    return `${i + 1}. ${name}${c.domain ? ` (${c.domain})` : ''}: ${c.signals} buying signal${c.signals === 1 ? '' : 's'}, last seen ${last}`;
  });
  const top = rows.slice(0, 3).map((c) => c.name ?? c.domain ?? 'Unknown');
  const fallback =
    rows.length === 0
      ? 'No companies are showing buying signals yet.'
      : `${rows.length} compan${rows.length === 1 ? 'y is' : 'ies are'} showing buying signals. The most active right now are ${top.join(
          ', ',
        )}. Add your own AI key on the Usage page for a smarter written summary.`;
  return runSummary(orgId, userId, {
    lines,
    count: rows.length,
    noun: 'companies',
    system:
      'You are a concise B2B sales assistant. Summarize a list of companies that are showing public buying signals.' +
      ' Group the most active accounts, say what makes each worth a look, and end with one line on which account to approach first.',
    fallback,
  });
}

/** Summarize the people and companies a user has saved into one list. */
export async function summarizeList(orgId: string, userId: string, listId: string): Promise<SummaryResult> {
  const list = await getList(orgId, listId);
  if (!list) return { ok: false, error: 'List not found.' };
  const members = await getListMembers(orgId, listId, {});
  const top = members.slice(0, MAX_CARDS);
  const lines = top.map((m, i) => {
    if (m.kind === 'person') {
      const role = [m.title, m.companyName].filter(Boolean).join(' at ');
      return `${i + 1}. ${m.name}${role ? `, ${role}` : ''}${m.location ? ` (${m.location})` : ''}`;
    }
    return `${i + 1}. ${m.name}${m.domain ? ` (${m.domain})` : ''} [company]`;
  });
  const peopleCount = members.filter((m) => m.kind === 'person').length;
  const companyCount = members.length - peopleCount;
  const fallback =
    members.length === 0
      ? 'This list is empty. Add people and companies from the feed or a research profile.'
      : `"${list.name}" holds ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} and ${companyCount} ${
          companyCount === 1 ? 'company' : 'companies'
        }. Add your own AI key on the Usage page for a smarter written summary.`;
  return runSummary(orgId, userId, {
    lines,
    count: members.length,
    noun: 'saved entries',
    system:
      `You are a concise B2B sales assistant. Summarize a saved list named "${list.name}" of people and companies a salesperson is tracking.` +
      ' Note who the standout contacts are and any patterns (shared role, company, or location), and end with one line on a good first outreach.',
    fallback,
  });
}
