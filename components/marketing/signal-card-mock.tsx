import { Globe, FileText, Heart, MessageCircle, Repeat2, GitBranch, TrendingUp } from 'lucide-react';
import { TypeBadge } from './type-badge';

export type FeedCard =
  | {
      kind: 'post';
      name: string;
      role: string;
      time: string;
      content: string;
      likes: number;
      comments: number;
      reposts: number;
      badges: string[];
      tag: string;
    }
  | {
      kind: 'source';
      icon?: 'globe' | 'doc' | 'git';
      domain: string;
      time: string;
      title: string;
      subtitle?: string;
      badges: string[];
    }
  | {
      kind: 'update';
      label: string;
      title: string;
      badges: string[];
    };

function initials(name: string) {
  return name
    .replace(/^@/, '')
    .split(/[\s_]+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Badges({ items }: { items: string[] }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {items.map((b) => (
        <TypeBadge key={b} tone="solid" wave>
          {b}
        </TypeBadge>
      ))}
    </div>
  );
}

const sourceIcons = { globe: Globe, doc: FileText, git: GitBranch } as const;

export function SignalCardMock({ card }: { card: FeedCard }) {
  if (card.kind === 'source') {
    const Icon = sourceIcons[card.icon ?? 'globe'];
    return (
      <article className="rounded-xl border border-border bg-[hsl(var(--card))] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--accent))] hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{card.domain}</span>
            <span className="opacity-50">{card.time}</span>
          </div>
          <Badges items={card.badges} />
        </div>
        <p className="mt-2 text-sm font-medium leading-snug">{card.title}</p>
        {card.subtitle && <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{card.subtitle}</p>}
      </article>
    );
  }

  if (card.kind === 'update') {
    return (
      <article className="rounded-xl border border-border bg-[hsl(var(--card))] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--accent))] hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            <span className="grid size-5 place-items-center rounded-md bg-[hsl(var(--muted))]">
              <TrendingUp className="size-3 text-[hsl(var(--accent))]" />
            </span>
            {card.label}
          </div>
          <Badges items={card.badges} />
        </div>
        <p className="mt-2 text-sm font-medium leading-snug">{card.title}</p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-[hsl(var(--card))] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--accent))] hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[hsl(var(--muted))] text-[11px] font-semibold text-[hsl(var(--foreground))]">
            {initials(card.name)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold leading-tight">{card.name}</span>
              <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">{card.time}</span>
            </div>
            <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">{card.role}</p>
          </div>
        </div>
        <Badges items={card.badges} />
      </div>
      <p className="mt-2.5 text-sm leading-snug">{card.content}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[11px] text-[hsl(var(--muted-foreground))]">
          <span className="flex items-center gap-1">
            <Heart className="size-3" /> {card.likes}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3" /> {card.comments}
          </span>
          <span className="flex items-center gap-1">
            <Repeat2 className="size-3" /> {card.reposts}
          </span>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {card.tag}
        </span>
      </div>
    </article>
  );
}
