import { cn } from '@/lib/utils';

/** Warm amber/brown tile carrying a small beacon glyph. Marketing only. */
export function MarketingLogoTile({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-[0.55rem] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]',
        className,
      )}
      aria-hidden
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-current">
        <circle cx="12" cy="12" r="2.6" fill="currentColor" />
        <path d="M12 4.8 a7.2 7.2 0 0 1 7.2 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.9" />
        <path d="M12 8 a4 4 0 0 1 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.55" />
      </svg>
    </span>
  );
}

export function MarketingLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <MarketingLogoTile />
      <span className="text-[1.05rem]">SignalScout</span>
    </span>
  );
}
