import { cn } from '@/lib/utils';

/** Warm-brown uppercase chip for the marketing feed cards and dossier tags. */
export function TypeBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-[hsl(var(--chip-bg))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--chip-fg))]',
        className,
      )}
    >
      {children}
    </span>
  );
}
