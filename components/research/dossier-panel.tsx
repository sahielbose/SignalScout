'use client';

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink, ShieldAlert, ShieldCheck, Quote, Sparkles, MessageSquare, Users, Loader2, ArrowRight, Mail, Copy, Check, ChevronDown } from 'lucide-react';
import type { GuardedDossier } from '@/lib/research/dossier';
import type { Fact } from '@/lib/types';
import { findSimilarAction, type SimilarActionResult } from '@/lib/research/actions';
import { draftEmailAction } from '@/lib/research/email-actions';
import type { EmailDraftResult } from '@/lib/research/email-draft';
import { toast } from '@/lib/toast';
import { usePref } from '@/lib/hooks/use-pref';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The major sections of the profile that can be folded away, in display order. */
const SECTIONS = ['summary', 'facts', 'outreach', 'tools', 'sources'] as const;
type SectionKey = (typeof SECTIONS)[number];

/**
 * Hook that owns the open/closed state of every collapsible section, each
 * remembered per-section in localStorage (via usePref) so the way a user likes
 * to read profiles sticks across visits and across people. Returns helpers to
 * read a section, toggle one, and expand/collapse them all at once.
 */
function useSectionPrefs() {
  const prefs: Record<SectionKey, [boolean, (v: boolean) => void]> = {
    summary: usePref<boolean>('person.section.summary', true),
    facts: usePref<boolean>('person.section.facts', true),
    outreach: usePref<boolean>('person.section.outreach', true),
    tools: usePref<boolean>('person.section.tools', true),
    sources: usePref<boolean>('person.section.sources', false),
  };
  const isOpen = (k: SectionKey) => prefs[k][0];
  const toggle = (k: SectionKey) => prefs[k][1](!prefs[k][0]);
  const setAll = (open: boolean) => {
    for (const k of SECTIONS) prefs[k][1](open);
  };
  const allOpen = SECTIONS.every((k) => prefs[k][0]);
  return { isOpen, toggle, setAll, allOpen };
}

/** A major section of the profile that can be folded away. Open state lives in the parent. */
function CollapsibleSection({
  title,
  hint,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md px-4 py-3 text-left transition-colors hover:bg-accent/40"
        title={open ? `Hide ${title.toLowerCase()}` : `Show ${title.toLowerCase()}`}
      >
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', open ? '' : '-rotate-90')}
        />
        <span className="text-sm font-semibold">{title}</span>
        {typeof count === 'number' && (
          <Badge variant="secondary" className="ml-0.5">
            {count}
          </Badge>
        )}
        {hint && <span className="ml-auto hidden text-xs text-muted-foreground sm:block">{hint}</span>}
      </button>
      {open && <div className="border-t px-4 py-3">{children}</div>}
    </div>
  );
}

/**
 * Render the whole research profile as plain text a user can paste into a CRM,
 * a doc, or an email. Every fact keeps its source link so the paste stays cited.
 */
function dossierToPlainText(dossier: GuardedDossier): string {
  const { identity, structured, tags, sources } = dossier;
  const lines: string[] = [];
  const pct = Math.round((dossier.confidence ?? 0) * 100);

  lines.push(identity.full_name);
  const headline = [identity.title, identity.company, identity.location].filter(Boolean).join(' · ');
  if (headline) lines.push(headline);
  lines.push(`${pct}% of the facts below are backed by a public source.`);
  if (tags.length) lines.push(`Tags: ${tags.join(', ')}`);
  lines.push('');

  if (dossier.summary) {
    lines.push('SUMMARY');
    lines.push(dossier.summary);
    lines.push('');
  }

  const factLine = (label: string, f?: Fact) => {
    if (f) lines.push(`- ${label}: ${f.value} (${f.source_url})`);
  };
  const factListLines = (label: string, fs?: Fact[]) => {
    for (const f of fs ?? []) lines.push(`- ${label}: ${f.value} (${f.source_url})`);
  };
  const hasFacts =
    structured.role ||
    structured.company ||
    structured.github_contributions ||
    structured.focus ||
    (structured.talks ?? []).length ||
    (structured.publications ?? []).length ||
    (structured.starred_repos ?? []).length;
  if (hasFacts) {
    lines.push('FACTS WE FOUND (each links to its source)');
    factLine('Role', structured.role);
    factLine('Company', structured.company);
    factLine('GitHub', structured.github_contributions);
    factLine('Focus', structured.focus);
    factListLines('Talk', structured.talks);
    factListLines('Publication', structured.publications);
    factListLines('Starred', structured.starred_repos);
    lines.push('');
  }

  if (dossier.why_they_care) {
    lines.push("WHY THEY'D CARE");
    lines.push(dossier.why_they_care);
    lines.push('');
  }
  if (dossier.suggested_opener) {
    lines.push('SUGGESTED OPENER');
    lines.push(dossier.suggested_opener);
    lines.push('');
  }
  if (sources.length) {
    lines.push(`SOURCES (${sources.length})`);
    sources.forEach((s, i) => lines.push(`${i + 1}. ${s.claim} - ${s.url}`));
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** A small copy button that flips to a check for a moment after a successful copy. */
function CopyButton({ text, label, copiedLabel, title }: { text: string; label: string; copiedLabel?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const run = async () => {
    if (!text.trim()) {
      toast('Nothing to copy yet', 'default');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast(`Copied ${label.toLowerCase()} to clipboard`, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Could not copy to clipboard', 'error');
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={run} title={title} className="shrink-0">
      {copied ? <Check className="text-primary" /> : <Copy />}
      {copied ? copiedLabel ?? 'Copied' : label}
    </Button>
  );
}

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

function SimilarPeople({ personId }: { personId: string }) {
  const [res, setRes] = useState<SimilarActionResult | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    setRes(null);
    start(async () => {
      const r = await findSimilarAction(personId);
      setRes(r);
      if (!r.ok) {
        toast(r.error ?? 'Could not find similar people', 'error');
      } else if (r.result && r.result.matches.length > 0) {
        const n = r.result.matches.length;
        toast(`Found ${n} similar ${n === 1 ? 'prospect' : 'prospects'}`, 'success');
      } else {
        toast(r.result?.note ?? 'No similar people found yet', 'default');
      }
    });
  };

  const matches = res?.ok ? res.result?.matches ?? [] : [];
  const listId = res?.ok ? res.result?.listId ?? null : null;

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Users className="size-3.5" /> Lookalike prospecting
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Find a few people at the same GitHub org or with a similar focus, collected into a Matches list.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={run} disabled={pending} className="shrink-0">
          {pending ? <Loader2 className="animate-spin" /> : <Users />}
          {pending ? 'Searching…' : 'Find similar people'}
        </Button>
      </div>

      {res?.ok && matches.length > 0 && (
        <div className="mt-3 animate-fade-up space-y-2">
          <ul className="space-y-1.5">
            {matches.map((m) => (
              <li
                key={m.personId}
                className="flex items-baseline justify-between gap-3 border-b py-1.5 text-sm last:border-0"
              >
                <Link href={`/people/${m.personId}`} className="font-medium hover:text-primary hover:underline">
                  {m.name}
                </Link>
                <span className="min-w-0 truncate text-right text-xs text-muted-foreground">
                  {[m.role, m.company].filter(Boolean).join(' · ') || (m.githubLogin ? `@${m.githubLogin}` : '')}
                </span>
              </li>
            ))}
          </ul>
          {listId && (
            <Link
              href={`/lists/${listId}`}
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 transition-colors hover:underline"
            >
              View the {res.result?.listName ?? 'Matches'} list
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      )}

      {res?.ok && matches.length === 0 && (
        <p className="mt-3 animate-fade-up text-xs text-muted-foreground">
          {res.result?.note ?? 'No similar people found yet.'}
        </p>
      )}
    </div>
  );
}

function DraftEmail({ personId }: { personId: string }) {
  const [res, setRes] = useState<EmailDraftResult | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const run = () => {
    setRes(null);
    setCopied(false);
    start(async () => {
      const r = await draftEmailAction(personId);
      setRes(r);
      if (!r.ok) {
        toast(r.error ?? 'Could not draft an email', 'error');
      } else {
        toast('Drafted a cold email from the dossier', 'success');
      }
    });
  };

  const copy = async () => {
    if (!res?.ok || !res.subject || !res.body) return;
    const text = `Subject: ${res.subject}\n\n${res.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast('Copied subject and body to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Could not copy to clipboard', 'error');
    }
  };

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Mail className="size-3.5" /> Outreach email draft
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Write a short, specific cold email from this person&apos;s cited research.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={run} disabled={pending} className="shrink-0">
          {pending ? <Loader2 className="animate-spin" /> : <Mail />}
          {pending ? 'Drafting…' : 'Draft email'}
        </Button>
      </div>

      {res?.ok && res.subject && res.body && (
        <div className="mt-3 animate-fade-up space-y-2 rounded-md border bg-muted/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">Subject</div>
              <p className="text-sm font-medium">{res.subject}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={copy} className="shrink-0">
              {copied ? <Check className="text-primary" /> : <Copy />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div>
            <div className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">Body</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{res.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function DossierPanel({
  dossier,
  meta,
  personId,
}: {
  dossier: GuardedDossier;
  meta?: { model?: string; cached?: boolean; toolCalls?: number };
  personId?: string;
}) {
  const { identity, structured, tags, sources } = dossier;
  const pct = Math.round((dossier.confidence ?? 0) * 100);
  const hasFacts = sources.length > 0;
  const fullText = dossierToPlainText(dossier);
  const sec = useSectionPrefs();

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
          title={
            dossier.lowConfidence
              ? `Only ${pct}% of the facts below could be backed by a public source we could link to. Read with care.`
              : `${pct}% of the facts below are backed by a public source we can link to (${sources.length} in total).`
          }
        >
          {dossier.lowConfidence ? <ShieldAlert className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          {dossier.lowConfidence ? `Low confidence · ${pct}% sourced` : `${pct}% sourced`}
        </div>
      </div>

      {/* copy options: the whole profile, or just the first line for a message */}
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton
          text={fullText}
          label="Copy profile"
          copiedLabel="Profile copied"
          title="Copy the whole profile as plain text (facts keep their source links) to paste into a CRM, doc, or email"
        />
        <CopyButton
          text={dossier.suggested_opener ?? ''}
          label="Copy opener"
          copiedLabel="Opener copied"
          title="Copy just the suggested first line you can drop into your message"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => sec.setAll(!sec.allOpen)}
          title={sec.allOpen ? 'Fold every section away' : 'Open every section'}
          className="shrink-0"
        >
          <ChevronDown className={cn('transition-transform duration-200', sec.allOpen ? '' : '-rotate-90')} />
          {sec.allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
        <span className="text-xs text-muted-foreground">
          Tip: each section below folds away, and Signal Scout remembers how you like to read profiles.
        </span>
      </div>

      {/* plain-English "what is this" helper */}
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        This research profile is built from public sources only. Every fact below links to where we found it, so you can
        check it yourself before you reach out. The badge at the top right shows how much of it we could back with a source.
      </div>

      {dossier.lowConfidence && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90">
          Low confidence: fewer than 60% of the drafted facts could be linked to a public source, so the unbacked ones were
          dropped to keep this honest. Double-check anything important. Adding this person&apos;s GitHub handle or LinkedIn
          URL usually gives a stronger result.
        </div>
      )}

      {/* summary (narrative) */}
      {dossier.summary && (
        <CollapsibleSection
          title="Narrative summary"
          hint="A short read on this person"
          open={sec.isOpen('summary')}
          onToggle={() => sec.toggle('summary')}
        >
          <div className="flex gap-2">
            <Quote className="size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed text-muted-foreground">{dossier.summary}</p>
          </div>
        </CollapsibleSection>
      )}

      {/* structured cited facts */}
      <CollapsibleSection
        title="Sourced facts"
        hint="Each links to where we found it"
        count={hasFacts ? sources.length : 0}
        open={sec.isOpen('facts')}
        onToggle={() => sec.toggle('facts')}
      >
        {hasFacts ? (
          <div>
            <FactRow label="Role" fact={structured.role} index={0} />
            <FactRow label="Company" fact={structured.company} index={1} />
            <FactRow label="GitHub" fact={structured.github_contributions} index={2} />
            <FactRow label="Focus" fact={structured.focus} index={3} />
            <FactList label="Talks" facts={structured.talks} index={4} />
            <FactList label="Publications" facts={structured.publications} index={5} />
            <FactList label="Starred" facts={structured.starred_repos} index={6} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            We could not find any public facts to link to for this person yet. Adding their GitHub handle or LinkedIn URL
            and refreshing usually helps.
          </p>
        )}
      </CollapsibleSection>

      {/* outreach: why they'd care + suggested opener */}
      <CollapsibleSection
        title="Outreach angle"
        hint="Why they'd care, and a first line"
        open={sec.isOpen('outreach')}
        onToggle={() => sec.toggle('outreach')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" /> Why they&apos;d care
            </div>
            <p className="text-[0.7rem] text-muted-foreground">An angle for your outreach, based on the facts above.</p>
            <p className="mt-1.5 text-sm">{dossier.why_they_care}</p>
          </div>
          <div className="rounded-md border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-beacon">
                <MessageSquare className="size-3.5" /> Suggested opener
              </div>
              <CopyButton
                text={dossier.suggested_opener ?? ''}
                label="Copy"
                title="Copy just this opening line into your message"
              />
            </div>
            <p className="text-[0.7rem] text-muted-foreground">A first line you can copy into your message.</p>
            <p className="mt-1.5 text-sm">{dossier.suggested_opener}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* outreach email draft + lookalike prospecting (only with a persisted person to anchor on) */}
      {personId && (
        <CollapsibleSection
          title="Outreach tools"
          hint="Draft an email, find similar people"
          open={sec.isOpen('tools')}
          onToggle={() => sec.toggle('tools')}
        >
          <div className="space-y-3">
            <DraftEmail personId={personId} />
            <SimilarPeople personId={personId} />
          </div>
        </CollapsibleSection>
      )}

      {/* sources */}
      {sources.length > 0 && (
        <CollapsibleSection
          title="Sources"
          count={sources.length}
          hint="Every link we used"
          open={sec.isOpen('sources')}
          onToggle={() => sec.toggle('sources')}
        >
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
        </CollapsibleSection>
      )}

      {meta && (
        <p className="text-[0.7rem] text-muted-foreground">
          {meta.cached ? 'Saved from an earlier run' : 'Freshly researched'}
          {meta.model ? ` · written by ${meta.model}` : ''}
        </p>
      )}
    </div>
  );
}
