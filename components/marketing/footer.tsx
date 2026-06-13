import Link from 'next/link';
import { MarketingLogo } from './marketing-logo';

type LinkItem = { label: string; href: string; external?: boolean };

const links: LinkItem[] = [
  { label: 'GitHub', href: 'https://github.com/sahielbose/Signal-Scout', external: true },
  { label: 'Open source', href: '/open-source' },
  { label: 'Integrations', href: '/#integrations' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Data removal', href: '/data-removal' },
];

const linkClass =
  'rounded-sm text-[hsl(var(--muted-foreground))] underline-offset-4 transition-colors duration-200 hover:text-[hsl(var(--foreground))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]';

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <MarketingLogo className="transition-transform duration-200 hover:-translate-y-0.5" />
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {links.map((l) =>
              l.external ? (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              ),
            )}
          </nav>
        </div>
        <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">(c) 2026 SignalScout, MIT licensed</span>
      </div>
    </footer>
  );
}
