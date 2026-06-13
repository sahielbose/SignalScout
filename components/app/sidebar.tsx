'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Radar,
  Crosshair,
  FileSearch,
  ListChecks,
  Building2,
  CalendarDays,
  Plug,
  Gauge,
  BarChart3,
  Settings,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketingLogo } from '@/components/marketing/marketing-logo';

export type NavItem = { href: string; label: string; icon: typeof Radar };

// Light grouping with plain-words section labels so the 9 destinations feel
// organized instead of a flat wall of links. NAV stays a single flat list for
// any consumer that just wants every destination (e.g. the mobile drawer).
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Find buyers',
    items: [
      { href: '/feed', label: 'Feed', icon: Radar },
      { href: '/icps', label: 'ICPs', icon: Crosshair },
      { href: '/research', label: 'Research', icon: FileSearch },
    ],
  },
  {
    label: 'Organize',
    items: [
      { href: '/lists', label: 'Lists', icon: ListChecks },
      { href: '/companies', label: 'Companies', icon: Building2 },
      { href: '/events', label: 'Events', icon: CalendarDays },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/integrations', label: 'Integrations', icon: Plug },
      { href: '/usage', label: 'Usage', icon: Gauge },
      { href: '/evals', label: 'Metrics', icon: BarChart3 },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

// Flat list of every destination, preserving the original order.
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActiveHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-primary/12 text-primary'
          : 'text-muted-foreground hover:translate-x-0.5 hover:bg-accent hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity duration-200',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <item.icon
        className={cn(
          'size-4 transition-transform duration-200',
          active ? '' : 'group-hover:scale-110',
        )}
      />
      {item.label}
    </Link>
  );
}

/** Fires a synthetic Cmd/Ctrl+K so the command palette opens from a click too. */
function openSearch() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }),
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-card/40 md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/feed" aria-label="Go to feed">
          <MarketingLogo />
        </Link>
      </div>
      <nav className="scroll-thin flex-1 space-y-4 overflow-y-auto p-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t p-2">
        <button
          type="button"
          onClick={openSearch}
          className="group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
            &#8984;K
          </kbd>
        </button>
      </div>
    </aside>
  );
}
