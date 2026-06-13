import { Github, Globe, FileText, Link2, MapPin, ChevronDown, Check } from 'lucide-react';
import { TypeBadge } from './type-badge';

const tags = ['Platform', 'API tooling', 'Open source', 'Series B'];

const fields: [string, string][] = [
  ['Company', 'Cobalt Labs'],
  ['Role', 'Staff Engineer, Platform'],
  ['GitHub', 'github.com/dokafor'],
  ['Focus', 'Developer tooling and APIs'],
];

const matches: [string, string][] = [
  ['Maya Chen', 'Platform Engineer, Northwind'],
  ['James Okafor', 'Staff Engineer, Junction Analytics'],
  ['Priya Narayan', 'Developer Experience, Brightwall'],
  ['Ryan Matsumoto', 'Senior Engineer, Atlas Freight'],
];

const sourceIcons = [Github, Globe, FileText, Link2];

function inits(n: string) {
  return n
    .split(' ')
    .map((p) => p[0])
    .join('');
}

export function DossierMock() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-[hsl(var(--card))] p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[hsl(var(--accent))] text-base font-semibold text-[hsl(var(--accent-foreground))]">
          DO
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold tracking-tight">Dana Okafor</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Staff Engineer @ Cobalt Labs</p>
          <div className="mt-2 flex items-center gap-1.5">
            {sourceIcons.map((Icon, i) => (
              <span
                key={i}
                className="grid size-6 place-items-center rounded-md border border-border text-[hsl(var(--muted-foreground))]"
              >
                <Icon className="size-3" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <MapPin className="size-3.5" /> Denver, Colorado
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <TypeBadge key={t} tone="soft">
            {t}
          </TypeBadge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 text-sm">
        {fields.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{k}</span>
            <span className={k === 'GitHub' ? 'font-mono text-xs' : 'font-medium'}>{v}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
        Owns the public API surface at Cobalt Labs, a heavy contributor to API and docs tooling on GitHub, and shipped
        three releases this quarter. Spoke about scaling a public API at DevConf.
      </p>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          Matches 4
        </p>
        <ChevronDown className="size-4 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div className="mt-2 space-y-1.5">
        {matches.map(([n, r]) => (
          <div key={n} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--muted))] text-[10px] font-semibold">
              {inits(n)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{n}</p>
              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{r}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <Check className="size-3.5 text-[hsl(var(--accent))]" /> Every fact carries a source
        </span>
        <TypeBadge tone="soft">High confidence</TypeBadge>
      </div>
    </div>
  );
}
