import Link from 'next/link';
import { ArrowRight, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrustStrip } from '@/components/marketing/trust-strip';

export const metadata = { title: 'Open source - SignalScout' };

const points = [
  {
    title: 'Public sources only',
    body: 'SignalScout reads SEC EDGAR, public job boards, GitHub, public web pages, and public events. No LinkedIn or X scraping, no bought or breached data.',
  },
  {
    title: 'Runs with zero keys',
    body: 'Every closed dependency has an offline fallback, so a fresh clone works immediately. Add your own keys to upgrade in place.',
  },
  {
    title: 'Swappable providers',
    body: 'The LLM and search providers sit behind interfaces with open self-host swaps, such as Ollama and a local search index. No closed dependency is load bearing.',
  },
  {
    title: 'Trust by construction',
    body: 'Strong-key entity resolution, per-source dedupe, cited dossiers, an eval harness, and cost ceilings ship from the first commit.',
  },
];

const quickstart = `git clone https://github.com/sahielbose/Signal-Scout.git
cd Signal-Scout
pnpm install
cp .env.example .env        # runs with zero keys, mocks kick in

docker compose up -d db     # Postgres and pgvector on port 5434
pnpm db:push                # create extensions and schema
pnpm seed                   # optional sample org, ICP, and signals
pnpm dev                    # web, REST, and HTTP MCP
pnpm worker                 # separate process, schedulers and ingestion`;

export default function OpenSourcePage() {
  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--accent))]">Open source</p>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Built in the open, free to run.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[hsl(var(--muted-foreground))]">
            SignalScout is MIT licensed and self-hostable end to end. The hosted tier is free and quota capped. Power
            users can bring their own keys and route spend to themselves.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="https://github.com/sahielbose/Signal-Scout" target="_blank" rel="noopener noreferrer">
                <Github /> View on GitHub
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">
                Get started <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-2">
          {points.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-[hsl(var(--card))] p-6">
              <h2 className="text-lg font-medium">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Self-host in a few commands</h2>
          <p className="mt-3 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
            Two processes run side by side: the web app and an always-on worker for scheduled ingestion. Postgres needs
            the vector and pg_trgm extensions.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-xl border border-[hsl(var(--ink-section-border))] bg-[hsl(var(--ink-section))] p-5 font-mono text-xs leading-relaxed text-[hsl(var(--ink-section-foreground))]">
            {quickstart}
          </pre>
        </div>
      </section>

      <TrustStrip />

      <section id="license" className="scroll-mt-20 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">License</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            SignalScout is released under the MIT license. The core is MIT, Apache, and Postgres licensed and
            self-hostable end to end. The only optional closed pieces, the hosted LLM API and hosted search, sit behind
            interfaces with open swaps. No secret is ever stored in code.
          </p>
        </div>
      </section>
    </>
  );
}
