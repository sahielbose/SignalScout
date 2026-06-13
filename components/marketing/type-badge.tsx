import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'soft' | 'solid';

/**
 * Uppercase type chip. `solid` is the warm-brown feed badge (with an optional
 * activity wave); `soft` is the lighter tag chip used in the dossier.
 */
export function TypeBadge({
  children,
  tone = 'soft',
  wave = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  wave?: boolean;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    soft: 'bg-[hsl(var(--chip-bg))] text-[hsl(var(--chip-fg))]',
    solid: 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        tones[tone],
        className,
      )}
    >
      {wave && <Activity className="size-2.5" />}
      {children}
    </span>
  );
}
