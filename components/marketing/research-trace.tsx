import { Check, Globe } from 'lucide-react';

const sources = [
  { url: 'github.com/dokafor', note: 'Maintainer on two infrastructure projects, active this week.' },
  { url: 'cobalt-labs.dev/blog', note: 'Authored the v3.0.0 release notes.' },
  { url: 'devconf.example/speakers', note: 'Talk, scaling a public API at Cobalt Labs.' },
  { url: 'sec.gov/edgar', note: 'No filings tied to this individual.' },
];

const steps = [
  'Expanding search',
  'Scanning GitHub org contributors across target accounts',
  'Scanning public event speaker lists',
  'Scoring ICP match and dropping uncited claims',
];

const people: [string, string][] = [
  ['Maya Chen', 'Platform Engineer, Northwind'],
  ['James Okafor', 'Staff Engineer, Junction Analytics'],
  ['Priya Narayan', 'Developer Experience, Brightwall'],
  ['Ryan Matsumoto', 'Senior Engineer, Atlas Freight'],
];

function inits(n: string) {
  return n
    .split(' ')
    .map((p) => p[0])
    .join('');
}

export function ResearchTrace() {
  return (
    <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-5">
      <div className="flex items-center gap-2">
        <span className="size-1.5 animate-pulse rounded-full bg-[hsl(var(--terracotta))]" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          SignalScout deep research
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {sources.map((s, i) => (
          <div
            key={s.url}
            style={{ animationDelay: `${i * 50}ms` }}
            className="animate-fade-up rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 transition-colors hover:border-[hsl(var(--accent))]"
          >
            <p className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--foreground))]">
              <Globe className="size-3 text-[hsl(var(--muted-foreground))]" />
              {s.url}
            </p>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{s.note}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
        Staff engineer in a developer-platform org, heavy committer to API and docs tooling. Searching for more people
        matching this pattern.
      </p>

      <div className="mt-4 space-y-1.5">
        {steps.map((st) => (
          <div key={st} className="flex items-start gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Check className="mt-px size-3.5 shrink-0 text-[hsl(var(--accent))]" />
            {st}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {people.map(([n, r], i) => (
          <div
            key={n}
            style={{ animationDelay: `${i * 50}ms` }}
            className="flex animate-fade-up items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:border-[hsl(var(--accent))]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[hsl(var(--muted))] text-[10px] font-semibold">
                {inits(n)}
              </span>
              <span className="shrink-0 text-sm font-medium">{n}</span>
              <span className="truncate text-xs text-[hsl(var(--muted-foreground))]">{r}</span>
            </div>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-[hsl(var(--accent))]">complete</span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Check className="size-3.5 text-[hsl(var(--accent))]" /> 4 people added to a list, created
        </div>
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Check className="size-3.5 text-[hsl(var(--accent))]" /> Research complete, 4 high-confidence matches
        </div>
      </div>

      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
        Found 4 high-confidence API platform buyers, all matching the example profile.
      </p>
    </div>
  );
}
