import { NextResponse } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/api/auth';
import { getPersonWithDossier } from '@/lib/research/people-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authenticateRequest(req);
  if (!actor) return unauthorized();
  const { id } = await params;
  const ctx = await getPersonWithDossier(actor.orgId, id);
  if (!ctx) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { person, companyName, companyDomain, dossier } = ctx;
  return NextResponse.json({
    person: {
      id: person.id,
      name: person.fullName,
      title: person.title,
      location: person.location,
      linkedin_url: person.linkedinUrl,
      github_login: person.githubLogin,
      company: companyName ? { id: person.companyId, name: companyName, domain: companyDomain } : null,
      confidence: person.confidence,
    },
    dossier: dossier
      ? {
          confidence: dossier.confidence,
          low_confidence: dossier.lowConfidence,
          tags: dossier.tags,
          summary: dossier.summary,
          structured: dossier.structured,
          why_they_care: dossier.why_they_care,
          suggested_opener: dossier.suggested_opener,
          sources: dossier.sources,
        }
      : null,
  });
}
