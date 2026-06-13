import { requireOrgId } from '@/lib/auth/session';
import { listApiKeys } from '@/lib/apikeys/service';
import { listWebhooks } from '@/lib/webhooks/service';
import { listIcps } from '@/lib/icp/service';
import { env } from '@/lib/env';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { ApiKeys } from '@/components/integrations/api-keys';
import { Webhooks } from '@/components/integrations/webhooks';
import { CopyBlock } from '@/components/integrations/copy-block';
import { Reveal } from '@/components/ui/reveal';

export const metadata = { title: 'Integrations - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const orgId = await requireOrgId();
  const [keys, hooks, icpRows] = await Promise.all([
    listApiKeys(orgId),
    listWebhooks(orgId),
    listIcps(orgId),
  ]);
  const base = env().NEXT_PUBLIC_APP_URL;
  const icpOptions = icpRows.map((i) => ({ id: i.id, name: i.name, active: i.active }));

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect Signal Scout to your own tools so the buying signals we find show up where you already work."
      />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Reveal>
          <Card className="p-5">
            <h2 className="text-sm font-semibold">How this works</h2>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">1.</span> Create an API key below. Think of it as a
                password that lets another tool read your Signal Scout data.
              </li>
              <li>
                <span className="font-medium text-foreground">2.</span> Paste that key into Claude or Cursor (the MCP
                setup), into your own scripts (the REST examples), or skip straight to webhooks.
              </li>
              <li>
                <span className="font-medium text-foreground">3.</span> Add a webhook if you want Signal Scout to ping
                your app automatically the moment a strong new buying signal appears.
              </li>
            </ol>
          </Card>
        </Reveal>

        <Reveal delay={40}>
          <Card className="p-5">
            <h2 className="text-sm font-semibold">API keys</h2>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">
              An API key is like a password that lets another tool read your Signal Scout data. Create one, copy it
              once, then paste it into the setups below. We never store the full key, so copy it right away. Lost it?
              Just make a new one.
            </p>
            <ApiKeys keys={keys} />
          </Card>
        </Reveal>

        <Reveal delay={80}>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">REST API (for your own scripts)</h2>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            Copy-paste examples to pull your signals, people, and lists into your own code or a tool like Zapier. Every
            request only ever sees your own team&apos;s data. Replace <code>$SSK</code> with an API key from above.
          </p>
          <CopyBlock
            code={`# Buying signals for your kind of customer (here: strong funding news)
curl -H "Authorization: Bearer \$SSK" \\
  "${base}/api/signals?type=funding&minStrength=0.6"

# A person and their research profile (with sources)
curl -H "Authorization: Bearer \$SSK" "${base}/api/people/<id>"

# Build (or refresh) a research profile for someone
curl -X POST -H "Authorization: Bearer \$SSK" \\
  -H "content-type: application/json" \\
  -d '{"name":"Guillermo Rauch","company":"Vercel"}' \\
  "${base}/api/research"

# Download one of your lists as a spreadsheet (CSV)
curl -H "Authorization: Bearer \$SSK" \\
  "${base}/api/lists/<list-id>/export.csv"`}
          />
        </Card>
        </Reveal>

        <Reveal delay={160}>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Webhooks (get pinged automatically)</h2>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            A webhook is a web address we POST to the moment a strong new buying signal (a public moment that suggests a
            company is ready to buy) shows up for your kind of customer. Add your app&apos;s URL below and we will notify
            it in real time. We never push to your CRM on our own, that always stays a deliberate, logged action you
            take.
          </p>
          <Webhooks
            icps={icpOptions}
            webhooks={hooks.map((w) => ({
              id: w.id,
              url: w.url,
              events: w.events,
              active: w.active,
              filters: w.filters ?? {},
            }))}
          />
        </Card>
        </Reveal>

        <Reveal delay={240}>
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Use it inside Claude or Cursor (MCP)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              MCP lets an AI assistant like Claude Desktop or Cursor talk to Signal Scout directly, so you can just ask
              it to find signals or pull up a research profile in plain English. Paste one of the configs below into your
              assistant&apos;s settings, then swap <code>$SSK</code> for an API key from the top of this page. It can
              search signals, look up a person and their cited research profile, list a company&apos;s signals, and
              export a list:{' '}
              <code>search_signals</code>, <code>get_person</code>, <code>generate_dossier</code>,{' '}
              <code>list_signals_for_company</code>, <code>export_list</code>.
            </p>
          </div>
          <CopyBlock
            label="Claude Desktop / Cursor - HTTP (hosted)"
            code={`{
  "mcpServers": {
    "signal-scout": {
      "url": "${base}/api/mcp",
      "headers": { "Authorization": "Bearer $SSK" }
    }
  }
}`}
          />
          <CopyBlock
            label="Claude Desktop - local stdio (self-host)"
            code={`{
  "mcpServers": {
    "signal-scout": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/Signal-Scout", "mcp"],
      "env": { "SIGNALSCOUT_API_KEY": "$SSK" }
    }
  }
}`}
          />
        </Card>
        </Reveal>
      </div>
    </>
  );
}
