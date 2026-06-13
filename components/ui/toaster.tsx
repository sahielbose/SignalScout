'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { subscribeToast, type ToastMessage } from '@/lib/toast';
import { cn } from '@/lib/utils';

const ICONS = { default: Info, success: CheckCircle2, error: AlertCircle };

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [leaving, setLeaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return subscribeToast((t) => {
      setToasts((prev) => [...prev, t]);
      // Start the exit animation slightly before removal, then drop from the list.
      setTimeout(() => setLeaving((prev) => ({ ...prev, [t.id]: true })), 3300);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
        setLeaving((prev) => {
          const next = { ...prev };
          delete next[t.id];
          return next;
        });
      }, 3500);
    });
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        const isLeaving = leaving[t.id];
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm shadow-lg transition-all duration-200',
              isLeaving ? 'translate-x-2 opacity-0' : 'animate-slide-in-right',
              t.variant === 'success' && 'border-primary/30',
              t.variant === 'error' && 'border-destructive/40',
            )}
          >
            <Icon
              className={cn(
                'size-4',
                t.variant === 'success' && 'text-primary',
                t.variant === 'error' && 'text-destructive',
                t.variant === 'default' && 'text-muted-foreground',
              )}
            />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
