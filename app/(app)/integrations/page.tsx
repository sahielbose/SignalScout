import { requireOrgId } from '@/lib/auth/session';
import { listApiKeys } from '@/lib/apikeys/service';
import { env } from '@/lib/env';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { ApiKeys } from '@/components/integrations/api-keys';

export const metadata = { title: 'Integrations — Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const orgId = await requireOrgId();
  const keys = await listApiKeys(orgId);
  const base = env().NEXT_PUBLIC_APP_URL;

  return (
    <>
      <PageHeader title="Integrations" description="Programmatic access — REST API keys, with MCP and webhooks alongside." />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">API keys</h2>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            Keys are hashed at rest — only the prefix is stored. Send as <code>Authorization: Bearer …</code>.
          </p>
          <ApiKeys keys={keys} />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">REST API</h2>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">All endpoints are scoped to your org and accept a bearer key.</p>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
{`# list ICP-matched signals
curl -H "Authorization: Bearer \$SSK" \\
  "${base}/api/signals?type=funding&minStrength=0.6"

# get a person + their cited dossier
curl -H "Authorization: Bearer \$SSK" "${base}/api/people/<id>"

# (re)generate a dossier
curl -X POST -H "Authorization: Bearer \$SSK" \\
  -H "content-type: application/json" \\
  -d '{"name":"Guillermo Rauch","company":"Vercel"}' \\
  "${base}/api/research"

# export a list as CSV
curl -H "Authorization: Bearer \$SSK" \\
  "${base}/api/lists/<list-id>/export.csv"`}
          </pre>
        </Card>

        <Card className="p-5 opacity-80">
          <h2 className="text-sm font-semibold">MCP server</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Copy-paste Claude Desktop / Cursor config lands in Phase 9 — query your signals and generate dossiers from inside your agent.
          </p>
        </Card>
      </div>
    </>
  );
}
