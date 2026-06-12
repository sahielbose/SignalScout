import { cosine } from '@/lib/providers/embed';
import type { IcpDefinition } from '@/lib/types';

/** Lexical hash embeddings are sparse, so the cosine floor is intentionally low. */
export const PREFILTER_THRESHOLD = 0.04;

export interface IcpWithEmbedding {
  id: string;
  name: string;
  definition: IcpDefinition;
  embedding: number[] | null;
}

export interface PrefilterResult {
  bestScore: number;
  candidates: IcpWithEmbedding[];
  scores: { id: string; score: number }[];
}

/** Cosine-match a signal embedding against active ICP embeddings. */
export function prefilter(
  signalEmbedding: number[],
  icps: IcpWithEmbedding[],
  threshold = PREFILTER_THRESHOLD,
): PrefilterResult {
  const scores = icps.map((icp) => ({
    icp,
    score: icp.embedding ? cosine(signalEmbedding, icp.embedding) : 0,
  }));
  const bestScore = scores.reduce((m, s) => Math.max(m, s.score), 0);
  const candidates = scores.filter((s) => s.score >= threshold).map((s) => s.icp);
  return {
    bestScore,
    candidates,
    scores: scores.map((s) => ({ id: s.icp.id, score: Math.round(s.score * 1000) / 1000 })),
  };
}
