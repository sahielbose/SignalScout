import { cn } from '@/lib/utils';

/** Signal Scout mark: a beacon emitting concentric signal rings. */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('text-primary', className)}
      aria-hidden
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9.5" stroke="currentColor" strokeOpacity="0.38" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="5" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
      <path
        d="M16 16 L26 6"
        stroke="hsl(var(--beacon))"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="26" cy="6" r="1.8" fill="hsl(var(--beacon))" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <Logo />
      <span className="text-[1.05rem]">
        Signal<span className="text-primary">Scout</span>
      </span>
    </span>
  );
}
