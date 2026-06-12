import { env } from '@/lib/env';
import { EMBED_DIM } from '@/lib/db/schema';

/**
 * Embedding provider behind an interface.
 *
 * Default = a deterministic LOCAL bag-of-words hash embedding (1536-d) so the
 * cosine ICP prefilter works with ZERO keys/offline. Cosine of two such vectors
 * tracks lexical overlap — good enough to cheaply gate which items reach the LLM.
 * Swap in a real embedder (OpenAI/Voyage/Ollama) by setting LLM_EMBED_MODEL and
 * implementing remoteEmbed below — the rest of the system is unchanged.
 */

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && t.length < 40);
}

// FNV-1a → index in [0, EMBED_DIM)
function hashIdx(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % EMBED_DIM;
}

const STOP = new Set([
  'the', 'and', 'for', 'are', 'with', 'this', 'that', 'from', 'has', 'have',
  'our', 'you', 'your', 'will', 'who', 'about', 'into', 'inc', 'llc',
]);

export function localEmbed(text: string): number[] {
  const v = new Array<number>(EMBED_DIM).fill(0);
  const tokens = tokenize(text).filter((t) => !STOP.has(t));
  for (const t of tokens) {
    const i = hashIdx(t);
    v[i] = (v[i] ?? 0) + 1;
  }
  for (let i = 0; i + 1 < tokens.length; i++) {
    const j = hashIdx(`${tokens[i]} ${tokens[i + 1]}`);
    v[j] = (v[j] ?? 0) + 0.5;
  }
  // L2 normalize
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

async function remoteEmbed(_texts: string[]): Promise<number[][] | null> {
  // TODO: wire a real embedder (OpenAI text-embedding-3-small / Voyage / Ollama).
  // Returning null falls back to localEmbed so the system always functions.
  return null;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (env().LLM_EMBED_MODEL) {
    const remote = await remoteEmbed(texts).catch(() => null);
    if (remote) return remote;
  }
  return texts.map(localEmbed);
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embed([text]))[0]!;
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
