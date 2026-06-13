'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Radar,
  Crosshair,
  FileSearch,
  ListChecks,
  Building2,
  Plug,
  Gauge,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketingLogo } from '@/components/marketing/marketing-logo';

const NAV = [
  { href: '/feed', label: 'Feed', icon: Radar },
  { href: '/icps', label: 'ICPs', icon: Crosshair },
  { href: '/research', label: 'Research', icon: FileSearch },
  { href: '/lists', label: 'Lists', icon: ListChecks },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/usage', label: 'Usage', icon: Gauge },
  { href: '/evals', label: 'Metrics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-card/40 md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/feed">
          <MarketingLogo />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:translate-x-0.5 hover:bg-accent hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all duration-200',
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
        })}
      </nav>
    </aside>
  );
}
