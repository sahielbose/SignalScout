import { z } from 'zod';
import { generateObject } from 'ai';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { dossiers, people } from '@/lib/db/schema';
import { getModel, modelId, logLlmRun, type LlmRunRecord } from '@/lib/providers/llm';
import { hasLLM } from '@/lib/env';
import { stripDashes, truncate } from '@/lib/utils';

const PROMPT_VERSION = 'email-draft-v1';

export interface EmailDraftResult {
  ok: boolean;
  subject?: string;
  body?: string;
  model?: string;
  error?: string;
}

interface LoadedDossier {
  fullName: string;
  title: string | null;
  company: string | null;
  summary: string | null;
  whyTheyCare: string | null;
  suggestedOpener: string | null;
  focus: string | null;
  tags: string[];
}

/**
 * Load the org-scoped latest dossier for a person. Fail closed: if this org has
 * no dossier for this person, return null (no cross-tenant reads).
 */
async function loadDossier(orgId: string, personId: string): Promise<LoadedDossier | null> {
  const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) return null;

  const [row] = await db
    .select()
    .from(dossiers)
    .where(and(eq(dossiers.personId, personId), eq(dossiers.orgId, orgId)))
    .orderBy(desc(dossiers.createdAt))
    .limit(1);
  if (!row) return null;

  const focus = row.structured?.focus?.value ?? null;
  const company = row.structured?.company?.value ?? person.title ?? null;
  return {
    fullName: person.fullName,
    title: row.structured?.role?.value ?? person.title ?? null,
    company: row.structured?.company?.value ?? company,
    summary: row.summary ?? null,
    whyTheyCare: row.whyTheyCare ?? null,
    suggestedOpener: row.suggestedOpener ?? null,
    focus,
    tags: row.tags ?? [],
  };
}

/** A concrete, citable detail to anchor the email on. */
function concreteDetail(d: LoadedDossier): string | null {
  if (d.focus) return d.focus;
  if (d.tags.length) return d.tags.slice(0, 2).join(' and ');
  if (d.title) return d.title;
  return null;
}

/** Deterministic, no-key templated draft assembled from cited dossier fields. */
function buildTemplateDraft(d: LoadedDossier): { subject: string; body: string } {
  const firstName = d.fullName.trim().split(/\s+/)[0] || d.fullName;
  const detail = concreteDetail(d);
  // The opener is written rep-to-prospect, so it is safe to address directly.
  const opener = d.suggestedOpener?.trim();

  const subject = detail
    ? truncate(`Quick question about your work on ${detail}`, 110)
    : `Quick question, ${firstName}`;

  const lines: string[] = [];
  lines.push(`Hi ${firstName},`);
  if (opener) {
    lines.push(opener);
  } else if (detail) {
    lines.push(`I came across your work around ${detail} and wanted to reach out.`);
  } else {
    lines.push(`I came across your work and wanted to reach out.`);
  }
  lines.push(
    detail
      ? `I work with teams thinking through ${detail}, and a few specifics in your background stood out.`
      : `A few specifics in your background stood out and I thought it was worth a note.`,
  );
  lines.push(
    detail
      ? `Would you be open to a short chat about how you are approaching ${detail}?`
      : `Would you be open to a short chat sometime this week?`,
  );
  lines.push('Best,');

  return { subject, body: lines.join('\n\n') };
}

const DraftSchema = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1),
});

/**
 * Draft a personalized cold outreach email from a person's cited dossier.
 * Org-scoped + fail-closed: returns an error result when the org has no dossier
 * for this person. Gates on hasLLM(): with no key it returns a deterministic
 * templated draft (never throws). Applies stripDashes to subject and body.
 */
export async function draftOutreachEmail(orgId: string, personId: string): Promise<EmailDraftResult> {
  if (!orgId || !personId) return { ok: false, error: 'Missing person.' };

  const d = await loadDossier(orgId, personId);
  if (!d) {
    return { ok: false, error: 'No dossier found for this person yet. Run research first.' };
  }

  // No LLM key → deterministic templated draft (never throws).
  const model = hasLLM() ? getModel('research') : null;
  if (!model) {
    const draft = buildTemplateDraft(d);
    return {
      ok: true,
      subject: stripDashes(draft.subject),
      body: stripDashes(draft.body),
      model: 'mock',
    };
  }

  const detail = concreteDetail(d);
  const context = [
    `NAME: ${d.fullName}`,
    d.title ? `ROLE: ${d.title}` : null,
    d.company ? `COMPANY: ${d.company}` : null,
    d.tags.length ? `TAGS: ${d.tags.join(', ')}` : null,
    d.focus ? `FOCUS: ${d.focus}` : null,
    d.summary ? `SUMMARY: ${d.summary}` : null,
    d.whyTheyCare ? `WHY THEY CARE: ${d.whyTheyCare}` : null,
    d.suggestedOpener ? `SUGGESTED OPENER: ${d.suggestedOpener}` : null,
    detail ? `CONCRETE DETAIL TO REFERENCE: ${detail}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const t0 = Date.now();
    const { object, usage } = await generateObject({
      model,
      schema: DraftSchema,
      temperature: 0.4,
      maxRetries: 1,
      system:
        `You write short, specific, non-salesy cold outreach emails for a B2B sales rep.\n` +
        `RULES:\n` +
        `- 3 to 5 sentences total in the body. No fluff, no buzzwords, no hard sell.\n` +
        `- Reference one concrete detail from the research so it reads as personal, not templated.\n` +
        `- Open with a greeting using the person's first name; close with a soft ask (a question, not a demand).\n` +
        `- Plain, warm, human tone. Do not invent facts beyond the provided research.\n` +
        `- subject is short (under ~8 words) and specific.`,
      prompt: `Write a cold outreach email to this person using ONLY the research below.\n\n${context}\n\nReturn { subject, body }.`,
    });
    const usedModel = modelId('research');

    await logLlmRun({
      orgId,
      kind: 'email_draft' as LlmRunRecord['kind'],
      model: usedModel,
      promptVersion: PROMPT_VERSION,
      input: { personId, name: truncate(d.fullName, 80) },
      output: { subject: object.subject },
      inputTokens: usage?.promptTokens,
      outputTokens: usage?.completionTokens,
      latencyMs: Date.now() - t0,
    });

    return {
      ok: true,
      subject: stripDashes(object.subject),
      body: stripDashes(object.body),
      model: usedModel,
    };
  } catch {
    // Model errored → fall back to a deterministic draft rather than failing.
    const draft = buildTemplateDraft(d);
    return {
      ok: true,
      subject: stripDashes(draft.subject),
      body: stripDashes(draft.body),
      model: 'mock',
    };
  }
}
