'use client';

import { useState, useTransition } from 'react';
import { Loader2, FileSearch, ChevronDown, Github, Link2, Quote } from 'lucide-react';
import { researchAction, type ResearchActionResult } from '@/lib/research/actions';
import { DossierPanel } from './dossier-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ResearchForm({ defaults }: { defaults?: { name?: string; company?: string; domain?: string } }) {
  const [name, setName] = useState(defaults?.name ?? '');
  const [company, setCompany] = useState(defaults?.company ?? '');
  const [linkedinUrl, setLinkedin] = useState('');
  const [githubLogin, setGithub] = useState('');
  const [domain] = useState(defaults?.domain ?? '');
  const [advanced, setAdvanced] = useState(false);
  const [res, setRes] = useState<ResearchActionResult | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setRes(null);
    start(async () => {
      const r = await researchAction({ name, company, domain, linkedinUrl, githubLogin });
      setRes(r);
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Card className="border-primary/15 bg-primary/[0.03] p-4">
        <div className="flex items-start gap-2.5 text-sm">
          <FileSearch className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-1.5">
            <p className="font-medium">How this works</p>
            <ol className="list-inside list-decimal space-y-0.5 text-muted-foreground">
              <li>Enter a person&apos;s name (a company helps us find the right one).</li>
              <li>We read their public footprint: GitHub, talks, articles, and more.</li>
              <li>You get a research profile where every fact links to its source.</li>
            </ol>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guillermo Rauch" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Vercel" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={`size-3 transition-transform duration-200 ${advanced ? 'rotate-180' : ''}`} /> Add a profile link for a stronger match (optional)
          </button>
          {advanced && (
            <div className="animate-fade-down space-y-3">
              <p className="text-xs text-muted-foreground">
                These help us make sure we found the right person. A GitHub handle gives the best, fully-sourced result because we can read their public work directly.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gh" className="flex items-center gap-1.5">
                    <Github className="size-3.5 text-muted-foreground" /> GitHub handle <span className="font-normal text-primary">best result</span>
                  </Label>
                  <Input id="gh" value={githubLogin} onChange={(e) => setGithub(e.target.value)} placeholder="rauchg" />
                  <p className="text-[0.7rem] text-muted-foreground">We read their public code, talks, and stars to fully source the profile.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="li" className="flex items-center gap-1.5">
                    <Link2 className="size-3.5 text-muted-foreground" /> LinkedIn URL
                  </Label>
                  <Input id="li" value={linkedinUrl} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/…" />
                  <p className="text-[0.7rem] text-muted-foreground">Used only to confirm the right person. We never scrape LinkedIn.</p>
                </div>
              </div>
            </div>
          )}

          <Button type="submit" disabled={pending || (!name && !linkedinUrl && !githubLogin)}>
            {pending ? <Loader2 className="animate-spin" /> : <FileSearch />}
            {pending ? 'Researching…' : 'Research'}
          </Button>
        </form>
      </Card>

      {pending && (
        <Card className="animate-scale-in space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="space-y-2 rounded-md border p-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Gathering public sources and verifying identity…
          </p>
        </Card>
      )}

      {res && !res.ok && res.quotaExceeded && (
        <Card className="animate-fade-up border-beacon/40 bg-beacon/5 p-4 text-sm">
          <p className="text-beacon">{res.error}</p>
          <a
            href="/usage"
            className="mt-1 inline-block text-xs text-primary underline-offset-4 transition-colors hover:underline"
          >
            Add your own API key on the Usage page →
          </a>
        </Card>
      )}
      {res && !res.ok && !res.quotaExceeded && (
        <Card className="animate-fade-up border-destructive/40 p-4 text-sm text-destructive">{res.error}</Card>
      )}

      {res?.ok && res.result && (
        <Card className="animate-scale-in p-5">
          <DossierPanel
            dossier={res.result.dossier}
            personId={res.result.personId ?? undefined}
            meta={{ model: res.result.model, cached: res.result.cached, toolCalls: res.result.toolCalls }}
          />
        </Card>
      )}

      {!pending && !res && (
        <Card className="animate-fade-up border-dashed bg-card/40 p-8 text-center">
          <FileSearch className="mx-auto size-7 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Start by entering a name above</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            We build a research profile from public sources only, and every fact links back to where we found it. Add a GitHub handle for the strongest, fully-sourced result.
          </p>
          <p className="mx-auto mt-3 flex max-w-md items-start justify-center gap-2 text-xs text-muted-foreground">
            <Quote className="mt-0.5 size-3 shrink-0" />
            Not sure who to try? Start with a name like &ldquo;Guillermo Rauch&rdquo; at &ldquo;Vercel&rdquo;.
          </p>
        </Card>
      )}
    </div>
  );
}
