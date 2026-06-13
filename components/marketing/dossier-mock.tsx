import { Fragment } from 'react';
import { Github, Globe, FileText } from 'lucide-react';
import { TypeBadge } from './type-badge';

const tags = ['Platform', 'Open source', 'Series B', 'Decision maker'];

const fields: [string, string][] = [
  ['Company', 'Cobalt Labs'],
  ['Role', 'Staff Engineer, Platform'],
  ['GitHub', 'github.com/dokafor'],
  ['Focus', 'Developer tooling and APIs'],
];

const matches: [string, string][] = [
  ['Priya Raman', 'Principal Engineer, Junction Analytics'],
  ['Marcus Lind', 'Head of Platform, Brightwall Energy'],
  ['Sofia Reyes', 'Staff Engineer, Atlas Freight'],
];

export function DossierMock() {
  return (
    <div className="rounded-xl border border-border bg-[hsl(var(--card))] p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[hsl(var(--accent))] text-sm font-semibold text-[hsl(var(--accent-foreground))]">
          DO
        </span>
        <div className="min-w-0">
          <p className="font-semibold tracking-tight">Dana Okafor</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Staff Engineer @ Cobalt Labs</p>
          <div className="mt-1.5 flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
            <span className="text-xs">Denver, Colorado</span>
            <Github className="size-3.5" />
            <Globe className="size-3.5" />
            <FileText className="size-3.5" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <TypeBadge key={t}>{t}</TypeBadge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {fields.map(([k, v]) => (
          <Fragment key={k}>
            <span className="text-[hsl(var(--muted-foreground))]">{k}</span>
            <span className={k === 'GitHub' ? 'font-mono text-xs' : ''}>{v}</span>
          </Fragment>
        ))}
      </div>

      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
        Dana owns the public API surface at Cobalt Labs and has shipped three releases this quarter.
      </p>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Matches</p>
        <div className="mt-2 space-y-2">
          {matches.map(([name, role]) => (
            <div key={name} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{name}</span>
              <span className="truncate text-right text-xs text-[hsl(var(--muted-foreground))]">{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
