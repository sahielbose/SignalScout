import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider';
import { db } from '@/lib/db/client';
import { llmRuns } from '@/lib/db/schema';
import { env, hasLLM } from '@/lib/env';

export type LlmKind = 'classify' | 'research' | 'dossier' | 'embed';

/**
 * Resolve a concrete AI-SDK model for a task, or null → caller uses a mock.
 * `overrideKey` (a user's bring-your-own Anthropic key) takes precedence over env
 * so power users pay their own LLM spend.
 */
export function getModel(kind: Exclude<LlmKind, 'embed'>, overrideKey?: string | null): LanguageModel | null {
  const e = env();
  if (e.GLOBAL_KILL_SWITCH) return null; // emergency brake halts all model spend
  if (e.LLM_PROVIDER === 'anthropic') {
    const apiKey = overrideKey || e.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    const anthropic = createAnthropic({ apiKey });
    return anthropic(kind === 'classify' ? e.LLM_CLASSIFY_MODEL : e.LLM_RESEARCH_MODEL);
  }
  if (e.LLM_PROVIDER === 'ollama') {
    const ollama = createOllama({ baseURL: `${e.OLLAMA_BASE_URL}/api` });
    return ollama(kind === 'classify' ? e.OLLAMA_CLASSIFY_MODEL : e.OLLAMA_RESEARCH_MODEL);
  }
  return null;
}

export function modelId(kind: Exclude<LlmKind, 'embed'>): string {
  const e = env();
  if (!hasLLM()) return 'mock';
  if (e.LLM_PROVIDER === 'anthropic')
    return kind === 'classify' ? e.LLM_CLASSIFY_MODEL : e.LLM_RESEARCH_MODEL;
  return kind === 'classify' ? e.OLLAMA_CLASSIFY_MODEL : e.OLLAMA_RESEARCH_MODEL;
}

// Rough public pricing (USD per 1M tokens) for cost accounting in llm_runs.
const PRICING: { match: RegExp; in: number; out: number }[] = [
  { match: /haiku/i, in: 1, out: 5 },
  { match: /sonnet/i, in: 3, out: 15 },
  { match: /opus/i, in: 5, out: 25 },
];

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING.find((x) => x.match.test(model));
  if (!p) return 0; // local/ollama/mock = free
  return (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out;
}

export interface LlmRunRecord {
  orgId?: string | null;
  kind: LlmKind;
  model: string;
  promptVersion?: string;
  input?: unknown;
  output?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  ok?: boolean;
}

let loggingEnabled = true;
/** Disable llm_runs persistence (used by the eval runner so it needs no DB). */
export function setLlmLogging(on: boolean): void {
  loggingEnabled = on;
}

export async function logLlmRun(rec: LlmRunRecord): Promise<void> {
  if (!loggingEnabled) return;
  const tokens = (rec.inputTokens ?? 0) + (rec.outputTokens ?? 0);
  try {
    await db.insert(llmRuns).values({
      orgId: rec.orgId ?? null,
      kind: rec.kind,
      model: rec.model,
      promptVersion: rec.promptVersion ?? null,
      input: rec.input ?? null,
      output: rec.output ?? null,
      tokens,
      costUsd: estimateCostUsd(rec.model, rec.inputTokens ?? 0, rec.outputTokens ?? 0),
      latencyMs: rec.latencyMs ?? 0,
      ok: rec.ok ?? true,
    });
  } catch (err) {
    // never let telemetry failures break the pipeline
    console.warn('[llm_runs] log failed:', (err as Error).message);
  }
}
