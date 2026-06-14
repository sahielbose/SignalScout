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
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePref } from '@/lib/hooks/use-pref';
import { MarketingLogo, MarketingLogoTile } from '@/components/marketing/marketing-logo';

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
      { href: '/profile', label: 'Profile', icon: User },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

// Flat list of every destination, preserving the original order.
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActiveHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function NavLink({
  item,
  active,
  collapsed = false,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      // When collapsed the label is hidden, so expose it to assistive tech and
      // as a native hover tooltip instead.
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center rounded-md text-sm font-medium transition-all duration-200',
        collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
        active
          ? 'bg-primary/12 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        !active && !collapsed && 'hover:translate-x-0.5',
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
          'size-4 shrink-0 transition-transform duration-200',
          active ? '' : 'group-hover:scale-110',
        )}
      />
      {!collapsed && item.label}
    </Link>
  );
}

/** Opens the command palette from a click (the same launcher as Cmd/Ctrl+K). */
function openSearch() {
  window.dispatchEvent(new CustomEvent('ss:open-search'));
}

export function Sidebar() {
  const pathname = usePathname();
  // Remembered, per-browser preference. Collapsing narrows the rail to icons
  // only, leaving more room for the page itself. Defaults to the full-label rail.
  const [collapsed, setCollapsed] = usePref<boolean>('sidebar-collapsed', false);

  return (
    <aside
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'hidden shrink-0 flex-col border-r bg-card/40 transition-[width] duration-200 ease-out md:flex',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <Link href="/feed" aria-label="Go to feed" className="group">
          {collapsed ? <MarketingLogoTile /> : <MarketingLogo />}
        </Link>
      </div>

      <nav
        className={cn(
          'scroll-thin flex-1 overflow-y-auto p-2',
          collapsed ? 'space-y-2' : 'space-y-4',
        )}
      >
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label} className="space-y-0.5">
            {collapsed ? (
              // No room for a word label; a hairline keeps the three groups
              // visually distinct (skip it above the first group).
              i > 0 && <div aria-hidden className="mx-2 mb-2 border-t border-border/60" />
            ) : (
              <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActiveHref(pathname, item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t p-2">
        <button
          type="button"
          onClick={openSearch}
          aria-label={collapsed ? 'Search and jump to any page, person, company, or signal' : undefined}
          title={collapsed ? 'Search and jump to any page, person, company, or signal' : undefined}
          className={cn(
            'group flex w-full items-center rounded-md text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          )}
        >
          <Search className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                &#8984;K
              </kbd>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand the sidebar to show labels' : 'Collapse the sidebar to icons only'}
          title={collapsed ? 'Expand the sidebar to show labels' : 'Collapse the sidebar to icons only'}
          className={cn(
            'flex w-full items-center rounded-md text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0" />
          )}
          {!collapsed && <span className="flex-1 text-left">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
