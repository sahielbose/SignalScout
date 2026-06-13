import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingLogo } from './marketing-logo';

const links = [
  { label: 'Platform', href: '/#platform' },
  { label: 'How it works', href: '/#research' },
  { label: 'Open source', href: '/open-source' },
  { label: 'Privacy', href: '/privacy' },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 animate-fade-down border-b border-border bg-[hsl(var(--background)/0.82)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center rounded-md transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          aria-label="SignalScout home"
        >
          <MarketingLogo />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group relative text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-[hsl(var(--foreground))] transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/feed">Open the app</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/login">
              Get started <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
