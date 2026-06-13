import { generateText } from 'ai';
import { getModel, modelId, logLlmRun, type LlmRunRecord } from '@/lib/providers/llm';
import { hasLLM } from '@/lib/env';
import { getByoKey } from '@/lib/users/service';
import { enforceQuota } from '@/lib/quota/service';
import { getFeed, type FeedFilters, type FeedItem } from '@/lib/feed/queries';
import { stripDashes } from '@/lib/utils';

export interface SummaryResult {
  ok: boolean;
  summary?: string;
  count?: number;
  /** True when the user's own AI key powered this (instead of the shared key). */
  usingOwnKey?: boolean;
  error?: string;
}

const MAX_CARDS = 30;

function describe(items: FeedItem[]): string {
  return items
    .map((s, i) => {
      const who = s.companyName ?? s.personName ?? 'Unknown';
      const what = (s.title ?? s.summary ?? '').replace(/\s+/g, ' ').slice(0, 160);
      const str = Math.round((s.strength ?? 0) * 100);
      return `${i + 1}. [${(s.type ?? 'signal').replace(/_/g, ' ')}] ${who}: ${what} (strength ${str}%)`;
    })
    .join('\n');
}

/** A no-key fallback so the tool always returns something useful. */
function deterministic(items: FeedItem[]): string {
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

/**
 * Read the cards in the user's current feed view and write a short plain-English
 * digest. Uses the user's own AI key when they have set one (so spend routes to
 * them and bypasses the shared quota), otherwise the shared key, otherwise a
 * deterministic fallback. Org-scoped through getFeed.
 */
export async function summarizeFeed(orgId: string, userId: string, filters: FeedFilters): Promise<SummaryResult> {
  const { items } = await getFeed(orgId, filters, 0);
  const top = items.slice(0, MAX_CARDS);
  if (top.length === 0) {
    return { ok: true, summary: 'There are no signals in this view to summarize yet.', count: 0, usingOwnKey: false };
  }

  const byoKey = await getByoKey(userId);
  try {
    await enforceQuota(orgId, 'research', { byoKey: !!byoKey });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const model = hasLLM() || byoKey ? getModel('research', byoKey) : null;
  if (!model) return { ok: true, summary: deterministic(top), count: top.length, usingOwnKey: !!byoKey };

  try {
    const t0 = Date.now();
    const { text, usage } = await generateText({
      model,
      temperature: 0.3,
      maxRetries: 1,
      system:
        'You are a concise B2B sales assistant. Summarize a feed of public buying signals for a salesperson in plain English. ' +
        'Group by theme, call out the 3 to 5 most promising opportunities and why, and end with one line on where to focus first. ' +
        'Keep it under 180 words. Write plain prose with NO markdown: no asterisks, no hash headers, no bullet characters. Use no em dashes and no emoji.',
      prompt: `Summarize these ${top.length} signals:\n\n${describe(top)}`,
    });
    await logLlmRun({
      orgId,
      kind: 'summarize' as LlmRunRecord['kind'],
      model: modelId('research'),
      input: { count: top.length },
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
    return { ok: true, summary: clean, count: top.length, usingOwnKey: !!byoKey };
  } catch {
    return { ok: true, summary: deterministic(top), count: top.length, usingOwnKey: !!byoKey };
  }
}
