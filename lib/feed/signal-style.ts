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
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { SignalType } from '@/lib/types';

export interface SignalStyle {
  /** colored badge classes (tuned for the warm light theme) */
  badge: string;
  /** left accent border color */
  border: string;
  dot: string;
  icon: LucideIcon;
}

// Literal class strings so Tailwind keeps them. Text shades are -700 so they
// read on the warm light surface; tints stay light.
export const SIGNAL_STYLE: Record<SignalType, SignalStyle> = {
  funding: { badge: 'bg-emerald-500/15 text-emerald-700', border: 'border-l-emerald-500/70', dot: 'bg-emerald-500', icon: Banknote },
  incorporation: { badge: 'bg-lime-500/15 text-lime-700', border: 'border-l-lime-500/70', dot: 'bg-lime-600', icon: Sparkles },
  hiring: { badge: 'bg-sky-500/15 text-sky-700', border: 'border-l-sky-500/70', dot: 'bg-sky-500', icon: Users },
  product_launch: { badge: 'bg-violet-500/15 text-violet-700', border: 'border-l-violet-500/70', dot: 'bg-violet-500', icon: Rocket },
  buying_intent: { badge: 'bg-amber-500/20 text-amber-700', border: 'border-l-amber-500/70', dot: 'bg-amber-500', icon: Target },
  expansion: { badge: 'bg-teal-500/15 text-teal-700', border: 'border-l-teal-500/70', dot: 'bg-teal-500', icon: TrendingUp },
  thought_leadership: { badge: 'bg-indigo-500/15 text-indigo-700', border: 'border-l-indigo-500/70', dot: 'bg-indigo-500', icon: BookOpen },
  event: { badge: 'bg-rose-500/15 text-rose-700', border: 'border-l-rose-500/70', dot: 'bg-rose-500', icon: CalendarDays },
  sec_filing: { badge: 'bg-slate-500/15 text-slate-700', border: 'border-l-slate-500/70', dot: 'bg-slate-500', icon: FileText },
  github_release: { badge: 'bg-zinc-500/15 text-zinc-700', border: 'border-l-zinc-500/70', dot: 'bg-zinc-500', icon: GitBranch },
  content: { badge: 'bg-stone-500/15 text-stone-700', border: 'border-l-stone-500/70', dot: 'bg-stone-500', icon: Newspaper },
  partnership: { badge: 'bg-cyan-500/15 text-cyan-700', border: 'border-l-cyan-500/70', dot: 'bg-cyan-500', icon: Handshake },
};

export function styleFor(type: string | null | undefined): SignalStyle {
  return (type && SIGNAL_STYLE[type as SignalType]) || SIGNAL_STYLE.content;
}

export function strengthTone(strength: number | null | undefined): { label: string; cls: string } {
  const s = strength ?? 0;
  if (s >= 0.7) return { label: 'Strong', cls: 'text-emerald-700' };
  if (s >= 0.45) return { label: 'Medium', cls: 'text-foreground' };
  return { label: 'Weak', cls: 'text-muted-foreground' };
}
