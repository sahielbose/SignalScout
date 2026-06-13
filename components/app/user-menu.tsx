'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UserMenu({ email, orgName }: { email: string; orgName: string }) {
  const initial = (email[0] ?? '?').toUpperCase();
  return (
    <div className="group flex animate-fade-in items-center gap-3">
      <div className="hidden text-right sm:block">
        <div className="text-xs font-medium leading-tight">{email}</div>
        <div className="text-[0.7rem] leading-tight text-muted-foreground">{orgName}</div>
      </div>
      <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary transition-transform duration-200 group-hover:scale-105">
        {initial}
      </div>
      <Button
        variant="ghost"
        size="icon"
        title="Sign out"
        className="transition-all duration-200 hover:shadow-sm active:scale-[0.96]"
        onClick={() => signOut({ redirectTo: '/login' })}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
