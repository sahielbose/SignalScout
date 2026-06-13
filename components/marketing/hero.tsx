import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignalFeedMock } from './signal-feed-mock';
import { WorldDots } from './world-dots';

const sources = ['SEC EDGAR', 'GitHub', 'Greenhouse', 'Lever', 'Ashby', 'lu.ma'];

export function Hero() {
  return (
    <section id="platform" className="relative scroll-mt-20 overflow-hidden border-b border-border">
      <WorldDots className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] w-full" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:pb-24 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-[hsl(var(--card))] px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            <span className="size-1.5 rounded-full bg-[hsl(var(--terracotta))]" />
            Open source, free to use
          </span>
          <h1 className="mt-6 text-balance text-[clamp(2.6rem,5.4vw,4.25rem)] font-semibold leading-[1.04] tracking-tight">
            Catch the buying signal the moment it goes public.
          </h1>
          <p className="mt-6 max-w-md text-lg text-[hsl(var(--muted-foreground))]">
            SignalScout watches free public sources for buying signals about your ideal customers, filters them by your
            ICP, and writes cited research dossiers on the people behind them.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Get started <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/feed">Open the app</Link>
            </Button>
          </div>
          <div className="mt-12">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Built on free public sources
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {sources.map((s, i) => (
                <span key={s} className="flex items-center gap-3">
                  {i > 0 && (
                    <span aria-hidden className="text-[hsl(var(--border))]">
                      /
                    </span>
                  )}
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:-mt-16">
          <SignalFeedMock />
        </div>
      </div>
    </section>
  );
}
