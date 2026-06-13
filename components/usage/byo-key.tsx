'use client';

import { useEffect, useState, useTransition } from 'react';
import { KeyRound, Check, Loader2, Trash2 } from 'lucide-react';
import { saveByoKeyAction, clearByoKeyAction } from '@/lib/users/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function QuotaMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const over = used >= limit;
  // Animate the bar fill and the percentage counter up from zero on mount.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn('font-mono text-xs tabular-nums transition-colors', over ? 'text-destructive' : 'text-muted-foreground')}>
          {used} / {limit}
          <span className="ml-1.5 opacity-70">{shown}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', over ? 'bg-destructive' : pct > 80 ? 'bg-beacon' : 'bg-primary')}
          style={{ width: `${shown}%` }}
        />
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
        toast('API key saved - your research now runs on your key', 'success');
        setSaved(true);
        setKey('');
      } else toast(r.error ?? 'Could not save key', 'error');
    });

  const clear = () =>
    start(async () => {
      await clearByoKeyAction();
      setSaved(false);
      toast('API key removed', 'default');
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <KeyRound className="size-4 text-muted-foreground" />
        {saved ? (
          <span className="inline-flex animate-fade-in items-center gap-1.5 text-primary">
            <Check className="size-4 animate-pop" /> Using your own key {masked ? <code className="text-xs text-muted-foreground">{masked}</code> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">No personal key - using the shared free tier.</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-…  (Anthropic key)"
          autoComplete="off"
        />
        <Button onClick={save} disabled={pending || !key} className="transition-all duration-200 hover:shadow-md active:scale-[0.98]">
          {pending ? <Loader2 className="animate-spin" /> : null} Save
        </Button>
        {saved && (
          <Button variant="ghost" size="icon" onClick={clear} disabled={pending} title="Remove key" className="animate-scale-in transition-all duration-200 active:scale-[0.96]">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Stored against your account and used only for your dossiers - it bypasses the shared daily quota. Never sent to the browser.
      </p>
    </div>
  );
}
