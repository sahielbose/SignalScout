import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, unauthorized } from '@/lib/api/auth';
import { generateDossier } from '@/lib/research/agent';
import { normalizeLinkedinUrl } from '@/lib/entity/normalize';
import { rateLimit, clientIp } from '@/lib/quota/ratelimit';
import { enforceQuota, QuotaError } from '@/lib/quota/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z.object({
  name: z.string().optional(),
  company: z.string().optional(),
  domain: z.string().optional(),
  linkedin_url: z.string().optional(),
  github_login: z.string().optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const actor = await authenticateRequest(req);
  if (!actor) return unauthorized();

  // per-IP burst limit (fail-open on infra errors)
  const rl = await rateLimit(`research:ip:${clientIp(req)}`, { capacity: 10, refillPerSec: 0.2 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited', detail: 'Too many requests — slow down.' }, { status: 429 });
  }

  const byoKey = req.headers.get('x-llm-key');
  try {
    await enforceQuota(actor.orgId, 'research', { byoKey: !!byoKey });
  } catch (err) {
    if (err instanceof QuotaError) {
      return NextResponse.json(
        { error: 'quota_exceeded', detail: err.message, used: err.used, limit: err.limit, byo_key_hint: 'Send an X-LLM-Key header to use your own LLM key.' },
        { status: 429 },
      );
    }
    throw err;
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  const b = parsed.data;
  const linkedinUrl = normalizeLinkedinUrl(b.linkedin_url);
  let name = (b.name ?? '').trim();
  if (!name && linkedinUrl) {
    name = (linkedinUrl.split('/in/')[1] ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (!name) return NextResponse.json({ error: 'name_or_linkedin_required' }, { status: 400 });

  const result = await generateDossier({
    name,
    company: b.company ?? null,
    domain: b.domain ?? null,
    linkedinUrl,
    githubLogin: b.github_login ?? null,
    orgId: actor.orgId,
    llmApiKey: byoKey,
    force: b.force,
  });

  return NextResponse.json({
    person_id: result.personId,
    cached: result.cached,
    model: result.model,
    dossier: {
      confidence: result.dossier.confidence,
      low_confidence: result.dossier.lowConfidence,
      identity: result.dossier.identity,
      tags: result.dossier.tags,
      summary: result.dossier.summary,
      structured: result.dossier.structured,
      why_they_care: result.dossier.why_they_care,
      suggested_opener: result.dossier.suggested_opener,
      sources: result.dossier.sources,
    },
  });
}
