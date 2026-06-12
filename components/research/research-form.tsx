'use client';

import { useState, useTransition } from 'react';
import { Loader2, FileSearch, ChevronDown } from 'lucide-react';
import { researchAction, type ResearchActionResult } from '@/lib/research/actions';
import { DossierPanel } from './dossier-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

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
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`size-3 transition-transform ${advanced ? 'rotate-180' : ''}`} /> Strong keys (optional)
          </button>
          {advanced && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="li">LinkedIn URL</Label>
                <Input id="li" value={linkedinUrl} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/in/…" />
                <p className="text-[0.7rem] text-muted-foreground">Used as an identity key only — never scraped.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gh">GitHub handle</Label>
                <Input id="gh" value={githubLogin} onChange={(e) => setGithub(e.target.value)} placeholder="rauchg" />
              </div>
            </div>
          )}

          <Button type="submit" disabled={pending || (!name && !linkedinUrl)}>
            {pending ? <Loader2 className="animate-spin" /> : <FileSearch />}
            {pending ? 'Researching…' : 'Research'}
          </Button>
        </form>
      </Card>

      {pending && (
        <Card className="space-y-3 p-5">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <p className="text-xs text-muted-foreground">Gathering public sources and verifying identity…</p>
        </Card>
      )}

      {res && !res.ok && res.quotaExceeded && (
        <Card className="border-beacon/40 bg-beacon/5 p-4 text-sm">
          <p className="text-beacon">{res.error}</p>
          <a href="/usage" className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline">
            Add your own API key on the Usage page →
          </a>
        </Card>
      )}
      {res && !res.ok && !res.quotaExceeded && (
        <Card className="border-destructive/40 p-4 text-sm text-destructive">{res.error}</Card>
      )}

      {res?.ok && res.result && (
        <Card className="p-5">
          <DossierPanel dossier={res.result.dossier} meta={{ model: res.result.model, cached: res.result.cached, toolCalls: res.result.toolCalls }} />
        </Card>
      )}
    </div>
  );
}
