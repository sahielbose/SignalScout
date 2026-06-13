import { z } from 'zod';
import { generateObject } from 'ai';
import { SignalTypeSchema, type SignalType, type IcpDefinition, type SourceName } from '@/lib/types';
import { getModel, modelId, logLlmRun } from '@/lib/providers/llm';
import { CLASSIFIER_SYSTEM, buildClassifierPrompt, PROMPT_VERSION } from './prompt';
import { mockClassify, type RawClassResult } from './mock';

export interface ClassifyInput {
  source: SourceName | string;
  text: string;
  title?: string;
  hint?: SignalType;
  url?: string;
  icps: { id: string; name: string; definition: IcpDefinition }[];
  orgId?: string | null;
}

export interface ClassifyResult {
  type: SignalType;
  strength: number;
  matchedIcpIds: string[];
  justification: string;
  model: string;
  promptVersion: string;
}

const LlmClassSchema = z.object({
  type: SignalTypeSchema,
  strength: z.number().min(0).max(1),
  matchedIcpIndexes: z.array(z.number().int().min(1)).default([]),
  justification: z.string().max(400),
});

function finalize(raw: RawClassResult, input: ClassifyInput, model: string): ClassifyResult {
  // Map 1-based indexes → ICP ids, dropping any out-of-range (anti-hallucination).
  const matchedIcpIds = Array.from(new Set(raw.matchedIcpIndexes))
    .filter((i) => i >= 1 && i <= input.icps.length)
    .map((i) => input.icps[i - 1]!.id);
  const strength = Math.max(0, Math.min(1, raw.strength));
  return {
    type: raw.type,
    strength: Math.round(strength * 100) / 100,
    matchedIcpIds,
    justification: raw.justification.slice(0, 400),
    model,
    promptVersion: PROMPT_VERSION,
  };
}

export async function classify(input: ClassifyInput): Promise<ClassifyResult> {
  const model = getModel('classify');
  const id = modelId('classify');
  const t0 = Date.now();

  if (!model) {
    const raw = mockClassify(input);
    await logLlmRun({
      orgId: input.orgId,
      kind: 'classify',
      model: 'mock',
      promptVersion: PROMPT_VERSION,
      input: { source: input.source, title: input.title, hint: input.hint },
      output: raw,
      latencyMs: Date.now() - t0,
    });
    return finalize(raw, input, 'mock');
  }

  try {
    const { object, usage } = await generateObject({
      model,
      schema: LlmClassSchema,
      system: CLASSIFIER_SYSTEM,
      prompt: buildClassifierPrompt(input),
      temperature: 0,
      maxRetries: 1,
    });
    await logLlmRun({
      orgId: input.orgId,
      kind: 'classify',
      model: id,
      promptVersion: PROMPT_VERSION,
      input: { source: input.source, title: input.title },
      output: object,
      inputTokens: usage?.promptTokens,
      outputTokens: usage?.completionTokens,
      latencyMs: Date.now() - t0,
    });
    return finalize(object, input, id);
  } catch (err) {
    // On any LLM/parse failure, fall back to the deterministic mock - never drop the item.
    const raw = mockClassify(input);
    await logLlmRun({
      orgId: input.orgId,
      kind: 'classify',
      model: `${id}:fallback-mock`,
      promptVersion: PROMPT_VERSION,
      input: { source: input.source, error: (err as Error).message },
      output: raw,
      latencyMs: Date.now() - t0,
      ok: false,
    });
    return finalize(raw, input, `${id}:fallback-mock`);
  }
}
