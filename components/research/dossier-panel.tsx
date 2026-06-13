import Link from 'next/link';
import { ExternalLink, ShieldAlert, ShieldCheck, Quote, Sparkles, MessageSquare } from 'lucide-react';
import type { GuardedDossier } from '@/lib/research/dossier';
import type { Fact } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function SourceLink({ url }: { url: string }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* keep raw */
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <ExternalLink className="size-3" />
      {host}
    </a>
  );
}

function FactRow({ label, fact, index = 0 }: { label: string; fact?: Fact; index?: number }) {
  if (!fact) return null;
  return (
    <div
      className="flex animate-fade-up flex-col gap-1 border-b py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-3"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1">
        <span className="text-sm">{fact.value}</span>
        <div className="mt-0.5">
          <SourceLink url={fact.source_url} />
        </div>
      </div>
    </div>
  );
}

function FactList({ label, facts, index = 0 }: { label: string; facts?: Fact[]; index?: number }) {
  if (!facts || facts.length === 0) return null;
  return (
    <div
      className="flex animate-fade-up flex-col gap-1 border-b py-2.5 last:border-0 sm:flex-row sm:gap-3"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {facts.map((f, i) => (
          <a
            key={i}
            href={f.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex animate-scale-in items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs transition-colors hover:border-primary/40 hover:text-primary"
            style={{ animationDelay: `${i * 40}ms` }}
            title={f.snippet}
          >
            {f.value}
            <ExternalLink className="size-2.5 opacity-60" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function DossierPanel({
  dossier,
  meta,
}: {
  dossier: GuardedDossier;
  meta?: { model?: string; cached?: boolean; toolCalls?: number };
}) {
  const { identity, structured, tags, sources } = dossier;
  const pct = Math.round((dossier.confidence ?? 0) * 100);
  const hasFacts = sources.length > 0;

  return (
    <div className="animate-scale-in space-y-5">
      {/* identity header */}
      <div className="flex animate-fade-down flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{identity.full_name}</h2>
          <p className="text-sm text-muted-foreground">
            {[identity.title, identity.company, identity.location].filter(Boolean).join(' · ') || 'No headline yet'}
          </p>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t, i) => (
                <span key={t} className="inline-flex animate-pop" style={{ animationDelay: `${i * 50}ms` }}>
                  <Badge variant="secondary">{t}</Badge>
                </span>
              ))}
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex animate-pop items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            dossier.lowConfidence ? 'border-amber-500/30 text-amber-400' : 'border-primary/30 text-primary',
          )}
          title={`${sources.length} cited fact(s)`}
        >
          {dossier.lowConfidence ? <ShieldAlert className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          {dossier.lowConfidence ? `Low confidence · ${pct}%` : `${pct}% cited`}
        </div>
      </div>

      {dossier.lowConfidence && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90">
          This dossier is low-confidence - fewer than 60% of drafted facts could be backed by a citable source, so unverified
          claims were dropped. Add a GitHub handle or LinkedIn URL, or connect a search provider, for a stronger result.
        </div>
      )}

      {/* summary */}
      {dossier.summary && (
        <div className="flex gap-2 rounded-md border bg-card p-4">
          <Quote className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">{dossier.summary}</p>
        </div>
      )}

      {/* structured cited facts */}
      {hasFacts ? (
        <div className="rounded-md border bg-card px-4">
          <FactRow label="Role" fact={structured.role} index={0} />
          <FactRow label="Company" fact={structured.company} index={1} />
          <FactRow label="GitHub" fact={structured.github_contributions} index={2} />
          <FactRow label="Focus" fact={structured.focus} index={3} />
          <FactList label="Talks" facts={structured.talks} index={4} />
          <FactList label="Publications" facts={structured.publications} index={5} />
          <FactList label="Starred" facts={structured.starred_repos} index={6} />
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No citable facts found for this person yet.
        </div>
      )}

      {/* outreach */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> Why they&apos;d care
          </div>
          <p className="mt-1.5 text-sm">{dossier.why_they_care}</p>
        </div>
        <div className="rounded-md border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-medium text-beacon">
            <MessageSquare className="size-3.5" /> Suggested opener
          </div>
          <p className="mt-1.5 text-sm">{dossier.suggested_opener}</p>
        </div>
      </div>

      {/* sources */}
      {sources.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sources ({sources.length})
          </h3>
          <ol className="space-y-1.5">
            {sources.map((s, i) => (
              <li key={i} className="flex animate-fade-up gap-2 text-xs" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="text-muted-foreground">{i + 1}.</span>
                <div className="min-w-0">
                  <span className="text-foreground">{s.claim}</span> <SourceLink url={s.url} />
                  <p className="truncate text-muted-foreground/70">{s.snippet}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {meta && (
        <p className="text-[0.7rem] text-muted-foreground">
          {meta.cached ? 'Cached' : 'Fresh'} · model {meta.model ?? '-'}
          {meta.toolCalls != null ? ` · ${meta.toolCalls} tool calls` : ''}
        </p>
      )}
    </div>
  );
}
