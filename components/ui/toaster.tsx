'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { subscribeToast, type ToastMessage } from '@/lib/toast';
import { cn } from '@/lib/utils';

const ICONS = { default: Info, success: CheckCircle2, error: AlertCircle };

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToast((t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    });
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm shadow-lg',
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
