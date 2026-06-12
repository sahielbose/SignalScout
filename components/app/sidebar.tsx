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
import { Wordmark } from '@/components/brand/logo';

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
          <Wordmark className="text-[0.95rem]" />
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
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
