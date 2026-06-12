import Link from 'next/link';
import { ArrowRight, Radar, FileSearch, Plug, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand/logo';

const features = [
  {
    icon: Radar,
    title: 'Live ICP-filtered feed',
    body: 'A continuous stream of public buying signals — funding filings, hiring surges, product launches, GitHub releases — scored against the customer profiles you define.',
  },
  {
    icon: FileSearch,
    title: 'Cited research dossiers',
    body: 'Point it at a person and get a structured profile where every fact carries a clickable source. Uncited claims are dropped; low-confidence results are flagged, never faked.',
  },
  {
    icon: Plug,
    title: 'Plugs into your stack',
    body: 'Dashboard, REST API, CSV export, and a first-class MCP server you can wire straight into Claude or Cursor.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust by construction',
    body: 'Strong-key entity resolution, per-source dedupe, an eval harness, cost ceilings, and free/public sources only — no LinkedIn or X scraping.',
  },
];

export default function Home() {
  return (
    <main className="relative">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/feed">Open app</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </nav>
      </header>

      <section className="radar-grid border-b">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Open-source · free to use · self-hostable
          </div>
          <h1 className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            See your next customer the moment the world does.
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            Signal Scout watches free, public sources for buying signals about your ideal customers,
            shows them in a live filtered feed, and writes cited research dossiers on the people
            behind them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/feed">
                Explore the feed <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/icps">Define an ICP</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6">
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-4 text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <Wordmark className="text-sm" />
          <p>MIT-licensed. Built on free and public data sources.</p>
        </div>
      </footer>
    </main>
  );
}
