import { authenticateRequest, unauthorized } from '@/lib/api/auth';
import {
  getList,
  getListMembers,
  parseExportColumns,
  parseMemberKind,
  parseMemberSort,
  buildExportTable,
} from '@/lib/lists/service';
import { toCsv } from '@/lib/delivery/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authenticateRequest(req);
  if (!actor) return unauthorized();
  const { id } = await params;

  const list = await getList(actor.orgId, id);
  if (!list) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });

  // Honor the same People/Companies filter and sort the user is viewing, plus
  // the column picker (`?cols=`), so the file matches what they see on screen.
  const url = new URL(req.url);
  const kind = parseMemberKind(url.searchParams.get('kind'));
  const sort = parseMemberSort(url.searchParams.get('sort'));
  // The picker is a plain HTML checkbox form, which repeats `cols=` per box;
  // a programmatic caller may instead pass one comma-joined `cols=a,b`. Accept
  // both by collapsing every `cols` value into one comma-separated string.
  const cols = parseExportColumns(url.searchParams.getAll('cols').join(','));

  const members = await getListMembers(actor.orgId, id, { kind, sort });
  const { headers, rows } = buildExportTable(members, cols);
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
