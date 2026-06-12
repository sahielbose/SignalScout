import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { authenticateRequest, unauthorized } from '@/lib/api/auth';
import { db } from '@/lib/db/client';
import { people, companies } from '@/lib/db/schema';
import { generateDossier } from '@/lib/research/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authenticateRequest(req);
  if (!actor) return unauthorized();
  const { id } = await params;

  const [p] = await db.select().from(people).where(eq(people.id, id)).limit(1);
  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let companyName: string | null = null;
  let domain: string | null = null;
  if (p.companyId) {
    const [c] = await db.select({ name: companies.name, domain: companies.domain }).from(companies).where(eq(companies.id, p.companyId)).limit(1);
    companyName = c?.name ?? null;
    domain = c?.domain ?? null;
  }

  const body = await req.json().catch(() => ({}));
  const result = await generateDossier({
    personId: p.id,
    name: p.fullName,
    company: companyName,
    domain,
    linkedinUrl: p.linkedinUrl,
    githubLogin: p.githubLogin,
    title: p.title,
    orgId: actor.orgId,
    force: body?.force === true,
  });

  return NextResponse.json({
    person_id: result.personId,
    cached: result.cached,
    model: result.model,
    cost_usd: result.costUsd,
    tool_calls: result.toolCalls,
    dossier: {
      confidence: result.dossier.confidence,
      low_confidence: result.dossier.lowConfidence,
      tags: result.dossier.tags,
      summary: result.dossier.summary,
      structured: result.dossier.structured,
      why_they_care: result.dossier.why_they_care,
      suggested_opener: result.dossier.suggested_opener,
      sources: result.dossier.sources,
    },
  });
}
