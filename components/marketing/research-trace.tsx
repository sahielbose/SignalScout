import { Check } from 'lucide-react';

const sources = [
  { url: 'github.com/dokafor', note: 'Maintainer on two infra projects, active this week.' },
  { url: 'cobalt-labs.dev/blog', note: 'Authored the v3.0.0 release notes.' },
  { url: 'sec.gov/edgar', note: 'No filings tied to this individual.' },
];

const steps = ['Resolved identity', 'Checked public events', 'Scored ICP match', 'Dropped uncited claims'];

export function ResearchTrace() {
  return (
    <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--accent))]">Analyzing profile</p>
      <div className="mt-4 space-y-2">
        {sources.map((s) => (
          <div key={s.url} className="rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2">
            <p className="font-mono text-xs text-[hsl(var(--foreground))]">{s.url}</p>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{s.note}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
        Dana leads platform work at Cobalt Labs and ships in the open.
      </p>
      <div className="mt-4 space-y-1.5">
        {steps.map((st) => (
          <div key={st} className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Check className="size-3.5 shrink-0 text-[hsl(var(--accent))]" />
            {st}
          </div>
        ))}
      </div>
    </div>
  );
}
