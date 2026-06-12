import { authenticateRequest, unauthorized } from '@/lib/api/auth';
import { getList, getListMembers } from '@/lib/lists/service';
import { toCsv } from '@/lib/delivery/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authenticateRequest(req);
  if (!actor) return unauthorized();
  const { id } = await params;

  const list = await getList(actor.orgId, id);
  if (!list) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });

  const members = await getListMembers(actor.orgId, id);
  const headers = ['type', 'name', 'title', 'company', 'domain', 'linkedin_url', 'github_login', 'location', 'added_at'];
  const rows = members.map((m) => [
    m.kind,
    m.name,
    m.title,
    m.companyName,
    m.domain,
    m.linkedinUrl,
    m.githubLogin,
    m.location,
    m.addedAt.toISOString(),
  ]);
  const csv = toCsv(headers, rows);
  const filename = `${list.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
