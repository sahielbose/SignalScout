'use client';

import { useEffect, useState, useTransition } from 'react';
import { KeyRound, Check, Loader2, Trash2, Rows3, AlignJustify } from 'lucide-react';
import { saveByoKeyAction, clearByoKeyAction } from '@/lib/users/actions';
import { usePref } from '@/lib/hooks/use-pref';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * One quota bar. "detailed" mode adds the percentage used and a plain-words
 * one-line breakdown; "compact" mode keeps just the bar and the amount left,
 * for users who want the page to stay small.
 */
export function QuotaMeter({
  label,
  hint,
  used,
  limit,
  detailed = true,
}: {
  label: string;
  hint?: string;
  used: number;
  limit: number;
  detailed?: boolean;
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
          {detailed ? <span className="ml-1 text-muted-foreground/70">({pct}%)</span> : null}
        </span>
      </div>
      <div
        className={cn('mt-1.5 overflow-hidden rounded-full bg-muted transition-[height]', detailed ? 'h-2.5' : 'h-1.5')}
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
        {detailed && hint ? (
          <span className="hidden shrink-0 text-right text-[11px] leading-tight text-muted-foreground sm:block sm:max-w-[55%]">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

type Meter = { label: string; hint: string; used: number; limit: number };

/**
 * The two quota bars plus a labeled view toggle. The toggle is remembered in
 * the browser (usePref) so the page opens the way the user last left it.
 * "Detailed" shows the percentage, a thicker bar, and the plain-words note for
 * each meter; "Compact" hides those so the page reads at a glance.
 */
export function QuotaMeters({ classify, research }: { classify: Meter; research: Meter }) {
  const [view, setView] = usePref<'detailed' | 'compact'>('usage:quota-view', 'detailed');
  const detailed = view === 'detailed';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">What you have used today</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Signal Scout is free, with a daily allowance of AI work. The bars below fill up as you use it and reset every
            day at midnight UTC.
          </p>
        </div>
        <div
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md border bg-muted/50 p-0.5"
          role="group"
          aria-label="How much detail to show"
        >
          <button
            type="button"
            onClick={() => setView('detailed')}
            aria-pressed={detailed}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              detailed ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <AlignJustify className="size-3.5" /> Detailed
          </button>
          <button
            type="button"
            onClick={() => setView('compact')}
            aria-pressed={!detailed}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
              !detailed ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Rows3 className="size-3.5" /> Compact
          </button>
        </div>
      </div>

      <div className={cn(detailed ? 'space-y-5' : 'space-y-3')}>
        <QuotaMeter label={classify.label} hint={classify.hint} used={classify.used} limit={classify.limit} detailed={detailed} />
        <QuotaMeter label={research.label} hint={research.hint} used={research.used} limit={research.limit} detailed={detailed} />
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
        toast('Key saved. Your research, email drafts, and summaries now run on your own key with no daily cap.', 'success');
        setSaved(true);
        setKey('');
      } else toast(r.error ?? 'Could not save key', 'error');
    });

  const clear = () =>
    start(async () => {
      const r = await clearByoKeyAction();
      if (r.ok) {
        setSaved(false);
        toast('Key removed. You are back on the shared free tier.', 'default');
      } else {
        toast(r.error ?? 'Could not remove key', 'error');
      }
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

      {/* Be honest about exactly which work the key powers today, so the toggle
          above and this section never imply an effect the app does not have. */}
      <div className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">What your key powers:</span> the AI work you trigger by hand runs on
        your key with no daily cap. That is your{' '}
        <span className="font-medium text-foreground">research profiles</span> (the deep, sourced write-ups on a person),
        your <span className="font-medium text-foreground">outreach email drafts</span>, and the{' '}
        <span className="font-medium text-foreground">Summarize</span> tool. Reading and tagging new public buying moments
        runs in the background on Signal Scout&apos;s shared free tier and stays within its own daily allowance, so that
        work keeps flowing whether or not you add a key.
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
