'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketingLogo } from '@/components/marketing/marketing-logo';
import { NAV_GROUPS, isActiveHref } from '@/components/app/sidebar';

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Drives the slide-in: starts off-screen, then animates to 0 once mounted.
  const [shown, setShown] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Trigger the left-to-right slide on the frame after the drawer mounts.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

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

  function openSearch() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('ss:open-search'));
  }

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
          <aside
            className={cn(
              'absolute left-0 top-0 flex h-full w-64 max-w-[80%] flex-col border-r bg-card shadow-xl transition-transform duration-200 ease-out',
              shown ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Link href="/feed" onClick={() => setOpen(false)} aria-label="Go to feed">
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
            <nav className="scroll-thin flex-1 space-y-4 overflow-y-auto p-2">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="space-y-0.5">
                  <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const active = isActiveHref(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                          active
                            ? 'bg-primary/12 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity duration-200',
                            active ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <item.icon className="size-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="border-t p-2">
              <button
                type="button"
                onClick={openSearch}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
              >
                <Search className="size-4" />
                Search and jump to anything
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
