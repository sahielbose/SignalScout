'use client';

import { useEffect, useState, useTransition } from 'react';
import { KeyRound, Check, Loader2, Trash2 } from 'lucide-react';
import { saveByoKeyAction, clearByoKeyAction } from '@/lib/users/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function QuotaMeter({
  label,
  hint,
  used,
  limit,
}: {
  label: string;
  hint?: string;
  used: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const over = used >= limit;
  const remaining = Math.max(0, limit - used);
  // Animate the bar fill up from zero on mount.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn('shrink-0 font-mono text-xs tabular-nums transition-colors', over ? 'text-destructive' : 'text-muted-foreground')}>
          {used.toLocaleString()} of {limit.toLocaleString()} used
        </span>
      </div>
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${used} of ${limit} used`}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', over ? 'bg-destructive' : pct > 80 ? 'bg-beacon' : 'bg-primary')}
          style={{ width: `${shown}%` }}
        />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className={cn('text-xs', over ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          {over ? "Today's allowance is used up. It resets tomorrow." : `${remaining.toLocaleString()} left today`}
        </span>
        {hint ? <span className="hidden shrink-0 text-right text-[11px] leading-tight text-muted-foreground sm:block sm:max-w-[55%]">{hint}</span> : null}
      </div>
    </div>
  );
}

export function ByoKey({ masked }: { masked: string | null }) {
  const [key, setKey] = useState('');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(!!masked);

  const save = () =>
    start(async () => {
      const r = await saveByoKeyAction(key);
      if (r.ok) {
        toast('Key saved. Your AI work now runs on your own key with no daily cap.', 'success');
        setSaved(true);
        setKey('');
      } else toast(r.error ?? 'Could not save key', 'error');
    });

  const clear = () =>
    start(async () => {
      await clearByoKeyAction();
      setSaved(false);
      toast('Key removed. You are back on the shared free tier.', 'default');
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <KeyRound className="size-4 shrink-0 text-muted-foreground" />
        {saved ? (
          <span className="inline-flex animate-fade-in items-center gap-1.5 text-primary">
            <Check className="size-4 animate-pop" /> Your own key is active, so the daily cap is off{' '}
            {masked ? <code className="text-xs text-muted-foreground">{masked}</code> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">No key added yet. You are on the shared free tier with a daily cap.</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your Anthropic key (starts with sk-ant-)"
          autoComplete="off"
          aria-label="Anthropic API key"
        />
        <Button onClick={save} disabled={pending || !key} className="transition-all duration-200 hover:shadow-md active:scale-[0.98]">
          {pending ? <Loader2 className="animate-spin" /> : null} {saved ? 'Replace' : 'Save'}
        </Button>
        {saved && (
          <Button variant="ghost" size="icon" onClick={clear} disabled={pending} title="Remove key" className="animate-scale-in transition-all duration-200 active:scale-[0.96]">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Your key is saved to your account and used only for your own research. It is never shown in the browser, and you
        can remove it any time.
      </p>
    </div>
  );
}
