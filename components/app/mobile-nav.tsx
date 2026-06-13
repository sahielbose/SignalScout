'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketingLogo } from '@/components/marketing/marketing-logo';
import { NAV } from '@/components/app/sidebar';

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape-to-close and prevent background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground active:scale-[0.96]"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 animate-fade-in bg-foreground/40 backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 max-w-[80%] flex-col border-r bg-card shadow-xl transition-transform duration-200 ease-out animate-slide-in-right">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Link href="/feed" onClick={() => setOpen(false)}>
                <MarketingLogo />
              </Link>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground active:scale-[0.96]"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto p-2">
              {NAV.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                      active
                        ? 'bg-primary/12 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all duration-200',
                        active ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
