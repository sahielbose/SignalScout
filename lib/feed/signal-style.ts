import {
  Banknote,
  Users,
  Rocket,
  Target,
  TrendingUp,
  BookOpen,
  CalendarDays,
  FileText,
  GitBranch,
  Newspaper,
  Handshake,
  type LucideIcon,
} from 'lucide-react';
import type { SignalType } from '@/lib/types';

export interface SignalStyle {
  /** colored badge classes (dark-first palette) */
  badge: string;
  /** left accent border color */
  border: string;
  dot: string;
  icon: LucideIcon;
}

// Literal class strings so Tailwind keeps them.
export const SIGNAL_STYLE: Record<SignalType, SignalStyle> = {
  funding: { badge: 'bg-emerald-500/15 text-emerald-300', border: 'border-l-emerald-500/70', dot: 'bg-emerald-400', icon: Banknote },
  hiring: { badge: 'bg-sky-500/15 text-sky-300', border: 'border-l-sky-500/70', dot: 'bg-sky-400', icon: Users },
  product_launch: { badge: 'bg-violet-500/15 text-violet-300', border: 'border-l-violet-500/70', dot: 'bg-violet-400', icon: Rocket },
  buying_intent: { badge: 'bg-amber-500/15 text-amber-300', border: 'border-l-amber-500/70', dot: 'bg-amber-400', icon: Target },
  expansion: { badge: 'bg-teal-500/15 text-teal-300', border: 'border-l-teal-500/70', dot: 'bg-teal-400', icon: TrendingUp },
  thought_leadership: { badge: 'bg-indigo-500/15 text-indigo-300', border: 'border-l-indigo-500/70', dot: 'bg-indigo-400', icon: BookOpen },
  event: { badge: 'bg-rose-500/15 text-rose-300', border: 'border-l-rose-500/70', dot: 'bg-rose-400', icon: CalendarDays },
  sec_filing: { badge: 'bg-slate-400/15 text-slate-300', border: 'border-l-slate-400/70', dot: 'bg-slate-400', icon: FileText },
  github_release: { badge: 'bg-zinc-400/15 text-zinc-300', border: 'border-l-zinc-400/70', dot: 'bg-zinc-300', icon: GitBranch },
  content: { badge: 'bg-stone-400/15 text-stone-300', border: 'border-l-stone-400/70', dot: 'bg-stone-400', icon: Newspaper },
  partnership: { badge: 'bg-cyan-500/15 text-cyan-300', border: 'border-l-cyan-500/70', dot: 'bg-cyan-400', icon: Handshake },
};

export function styleFor(type: string | null | undefined): SignalStyle {
  return (type && SIGNAL_STYLE[type as SignalType]) || SIGNAL_STYLE.content;
}

export function strengthTone(strength: number | null | undefined): { label: string; cls: string } {
  const s = strength ?? 0;
  if (s >= 0.7) return { label: 'Strong', cls: 'text-beacon' };
  if (s >= 0.45) return { label: 'Medium', cls: 'text-primary' };
  return { label: 'Weak', cls: 'text-muted-foreground' };
}
