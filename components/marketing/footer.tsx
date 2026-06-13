import Link from 'next/link';
import { MarketingLogo } from './marketing-logo';

type LinkItem = { label: string; href: string; external?: boolean };

const columns: { title: string; links: LinkItem[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Feed', href: '/feed' },
      { label: 'Research', href: '/feed' },
      { label: 'Integrations', href: '/#integrations' },
      { label: 'Usage', href: '/usage' },
    ],
  },
  {
    title: 'Open source',
    links: [
      { label: 'GitHub', href: 'https://github.com/sahielbose/Signal-Scout', external: true },
      { label: 'Self-host', href: '/open-source' },
      { label: 'License', href: '/open-source#license' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Data removal', href: '/data-removal' },
    ],
  },
];

const linkClass =
  'text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]';

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <MarketingLogo />
            <p className="mt-3 max-w-xs text-sm text-[hsl(var(--muted-foreground))]">
              Real-time prospect signal intelligence, built on public data.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className={linkClass}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border pt-6 text-xs text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center">
          <span>(c) 2026 SignalScout</span>
          <span>MIT licensed. Public data only.</span>
        </div>
      </div>
    </footer>
  );
}
