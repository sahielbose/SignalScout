import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignalFeedMock } from './signal-feed-mock';
import { WorldDots } from './world-dots';

export function Hero() {
  return (
    <section id="platform" className="relative scroll-mt-20 overflow-hidden border-b border-border">
      <WorldDots className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] w-full" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:pb-24 lg:pt-24">
        <div>
          <h1 className="animate-fade-up text-balance text-[clamp(2.6rem,5.4vw,4.25rem)] font-semibold leading-[1.04] tracking-tight">
            Catch the buying signal the moment it goes public.
          </h1>
          <p
            className="animate-fade-up mt-6 max-w-lg text-lg text-[hsl(var(--muted-foreground))]"
            style={{ animationDelay: '90ms' }}
          >
            SignalScout watches free public sources for the moments that show a company is ready to buy, like raising
            money, hiring sales roles, or launching a product. You tell it who your customers are, and it gives you a
            live feed of those moments plus a researched, source-backed profile of the people behind them.
          </p>
          <div
            className="animate-fade-up mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: '180ms' }}
          >
            <Button asChild size="lg">
              <Link href="/login">
                Get started <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/feed">Open the app</Link>
            </Button>
          </div>
        </div>
        <div className="animate-fade-up" style={{ animationDelay: '270ms' }}>
          <SignalFeedMock />
        </div>
      </div>
    </section>
  );
}
