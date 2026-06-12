import { eq, isNull, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { signals, type Icp } from '@/lib/db/schema';
import { listActiveIcps } from '@/lib/icp/service';
import { embedOne } from '@/lib/providers/embed';
import { prefilter, type IcpWithEmbedding } from '@/lib/classify/prefilter';
import { classify } from '@/lib/classify/classifier';
import { consumeQuota } from '@/lib/quota/service';
import type { SignalType } from '@/lib/types';

const MAX_ICPS_IN_PROMPT = 8;

function toIcpWithEmbedding(icp: Icp): IcpWithEmbedding {
  return { id: icp.id, name: icp.name, definition: icp.definition, embedding: icp.embedding };
}

export interface ClassifyRunResult {
  classified: number;
  matched: number;
  skipped: number;
}

/** Classify signals that haven't been typed yet (type is null). */
export async function classifyPendingSignals(opts: {
  limit?: number;
  orgId?: string | null;
} = {}): Promise<ClassifyRunResult> {
  const activeIcps = (await listActiveIcps(opts.orgId ?? undefined)).map(toIcpWithEmbedding);

  const pending = await db
    .select()
    .from(signals)
    .where(isNull(signals.type))
    .orderBy(desc(signals.ingestedAt))
    .limit(opts.limit ?? 50);

  let classified = 0;
  let matched = 0;
  let skipped = 0;

  for (const s of pending) {
    // daily classify-budget ceiling (per org) — stop when exhausted
    if (opts.orgId) {
      const q = await consumeQuota(opts.orgId, 'classify');
      if (!q.allowed) {
        skipped = pending.length - classified;
        break;
      }
    }
    const text = [s.title, s.rawContent].filter(Boolean).join('\n');
    const embedding = await embedOne(text || s.source);
    const pf = prefilter(embedding, activeIcps);

    // Narrow the prompt to candidate ICPs (cost control); fall back to top-scoring ones.
    let useIcps = pf.candidates;
    if (useIcps.length === 0) {
      useIcps = activeIcps
        .map((icp) => icp)
        .sort(
          (a, b) =>
            (pf.scores.find((x) => x.id === b.id)?.score ?? 0) -
            (pf.scores.find((x) => x.id === a.id)?.score ?? 0),
        )
        .slice(0, MAX_ICPS_IN_PROMPT);
    } else {
      useIcps = useIcps.slice(0, MAX_ICPS_IN_PROMPT);
    }

    const hint = s.classification?.hint as SignalType | undefined;
    const result = await classify({
      source: s.source,
      text: s.rawContent ?? '',
      title: s.title ?? undefined,
      hint,
      icps: useIcps.map((i) => ({ id: i.id, name: i.name, definition: i.definition })),
      orgId: opts.orgId ?? null,
    });

    await db
      .update(signals)
      .set({
        type: result.type,
        strength: result.strength,
        matchedIcpIds: result.matchedIcpIds,
        classification: {
          justification: result.justification,
          model: result.model,
          promptVersion: result.promptVersion,
          prefilterScore: Math.round(pf.bestScore * 1000) / 1000,
          hint,
        },
        embedding,
      })
      .where(eq(signals.id, s.id));

    classified++;
    if (result.matchedIcpIds.length) matched++;
  }

  return { classified, matched, skipped };
}
