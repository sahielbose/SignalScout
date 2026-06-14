'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UserMenu({ email, orgName }: { email: string; orgName: string }) {
  const initial = (email[0] ?? '?').toUpperCase();
  return (
    <div className="group flex animate-fade-in items-center gap-3">
      <Link
        href="/profile"
        title="View your profile"
        className="flex items-center gap-3 rounded-md px-1 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="hidden min-w-0 text-right sm:block">
          <div className="truncate text-xs font-medium leading-tight">{email}</div>
          <div className="truncate text-[0.7rem] leading-tight text-muted-foreground">{orgName}</div>
        </div>
        <div
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary transition-transform duration-200 group-hover:scale-105"
        >
          {initial}
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        title="Sign out"
        aria-label="Sign out"
        className="transition-all duration-200 hover:shadow-sm active:scale-[0.96]"
        onClick={() => signOut({ redirectTo: '/login' })}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
