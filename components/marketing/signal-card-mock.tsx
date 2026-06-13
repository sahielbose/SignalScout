import { TypeBadge } from './type-badge';

export type MockSignal = {
  source: string;
  time: string;
  summary: string;
  type: string;
  person?: { name: string; meta: string };
};

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
}

export function SignalCardMock({ signal }: { signal: MockSignal }) {
  return (
    <article className="rounded-xl border border-border bg-[hsl(var(--card))] p-4 shadow-sm">
      <div className="flex items-center justify-between font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
        <span>{signal.source}</span>
        <span>{signal.time}</span>
      </div>
      <p className="mt-2 text-sm leading-snug text-[hsl(var(--foreground))]">{signal.summary}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <TypeBadge>{signal.type}</TypeBadge>
        {signal.person && (
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-[hsl(var(--muted))] text-[10px] font-semibold text-[hsl(var(--foreground))]">
              {initials(signal.person.name)}
            </span>
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {signal.person.name} <span className="opacity-60">{signal.person.meta}</span>
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
