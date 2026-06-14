'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The strength score on a signal, now click-to-explain. Strength is the AI's
 * 0 to 100 percent rating of how strong a buying moment an item is for the
 * customers you sell to (set in lib/classify, stored on signals.strength). The
 * popover spells that out in plain words and shows the AI's own reasoning, so
 * the number is never a mystery.
 */
export function StrengthInfo({
  pct,
  strong,
  toneCls,
  typeLabel,
  sourceLabel,
  justification,
  matchedNames,
}: {
  pct: number;
  /** True when the bar should use the "hot" beacon color (strength >= 70%). */
  strong: boolean;
  toneCls: string;
  typeLabel: string;
  sourceLabel: string;
  justification?: string | null;
  /** Names of the user's customer types (ICPs) this signal matched. */
  matchedNames?: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Strength ${pct} percent. Click to see how this score is set.`}
        className="flex items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
          <span
            className={cn('block h-full rounded-full transition-[width] duration-500 ease-out', strong ? 'bg-beacon' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className={cn('font-mono text-xs font-medium', toneCls)}>{pct}%</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="How strength is set"
          className="absolute right-0 top-full z-30 mt-1.5 w-72 animate-scale-in rounded-md border bg-popover p-3 text-left text-popover-foreground shadow-lg"
        >
          <p className="text-xs font-semibold">Strength {pct}%</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            How likely this is a real buying moment for the kind of customer you sell to. Signal Scout&apos;s AI rates
            every item from 0 to 100 percent: 0 is noise, 100 is an urgent, high-intent moment.
          </p>
          {matchedNames && matchedNames.length > 0 && (
            <p className="mt-2 text-xs">
              <span className="text-muted-foreground">Matches your customer type: </span>
              <span className="font-medium">{matchedNames.join(', ')}</span>
            </p>
          )}
          {justification && (
            <p className="mt-2 text-xs">
              <span className="text-muted-foreground">Why: </span>
              {justification}
            </p>
          )}
          <p className="mt-2 text-[11px] leading-tight text-muted-foreground/80">
            Set by the AI when it read this {typeLabel} item from {sourceLabel}.
          </p>
        </div>
      )}
    </div>
  );
}
