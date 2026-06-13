'use client';

import { use, useEffect, useState, useTransition } from 'react';
import { notFound } from 'next/navigation';
import { Sparkles, Lock, Loader2, FileSearch } from 'lucide-react';
import type { PersonWithContext } from '@/lib/research/people-queries';
import { enrichPersonAction, getPersonViewData } from '@/lib/enrichment/actions';
import { toast } from '@/lib/toast';
import { PageHeader } from '@/components/app/page-header';
import { DossierPanel } from '@/components/research/dossier-panel';
import { RefreshDossier } from '@/components/research/refresh-dossier';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

/** Enrich-contact control. Disabled with a hint when paid enrichment is off. */
function EnrichButton({
  personId,
  enabled,
  onEnriched,
}: {
  personId: string;
  enabled: boolean;
  onEnriched: () => void;
}) {
  const [pending, start] = useTransition();

  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Look up extra contact details (like an email) from a paid data provider. An admin turns this on in settings."
        >
          <Lock />
          Find contact details
        </Button>
        <span className="text-xs text-muted-foreground">turned off</span>
      </span>
    );
  }

  const run = () =>
    start(async () => {
      const r = await enrichPersonAction(personId);
      if (r.enriched) {
        toast(
          r.fields.length ? `Enriched: ${r.fields.join(', ')}` : 'Enriched (no new fields)',
          'success',
        );
        onEnriched();
      } else {
        toast(r.reason, 'error');
      }
    });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={run}
      disabled={pending}
      className="group hover:shadow-md"
      title="Look up extra contact details (like an email) from a paid data provider"
    >
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles className="transition-transform duration-300 group-hover:scale-110" />}
      {pending ? 'Looking up…' : 'Find contact details'}
    </Button>
  );
}

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ ctx: PersonWithContext | null; enrichmentEnabled: boolean } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    getPersonViewData(id).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [id, nonce]);

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading profile…
      </div>
    );
  }

  if (!data.ctx) notFound();

  const { person, companyName, dossier, meta } = data.ctx;
  const reload = () => setNonce((n) => n + 1);
  const subtitle = [person.title, companyName, person.location].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        backHref="/feed"
        backLabel="Back to feed"
        title={person.fullName}
        description={
          subtitle
            ? `${subtitle}. A research profile of this person, built from public sources, to help you reach out.`
            : 'A research profile of this person, built from public sources, to help you reach out.'
        }
      >
        <EnrichButton personId={person.id} enabled={data.enrichmentEnabled} onEnriched={reload} />
        <RefreshDossier
          personId={person.id}
          name={person.fullName}
          company={companyName}
          hasDossier={!!dossier}
          onDone={reload}
        />
      </PageHeader>

      <div className="mx-auto max-w-3xl space-y-4 p-6">
        {dossier ? (
          <Card className="p-5">
            <DossierPanel
              dossier={dossier}
              personId={person.id}
              meta={meta ? { model: meta.model ?? undefined, cached: meta.cached } : undefined}
            />
          </Card>
        ) : (
          <Card className="flex flex-col items-center gap-4 p-12 text-center">
            <FileSearch className="size-6 text-muted-foreground" />
            <div className="space-y-1.5">
              <p className="text-sm font-medium">No research profile yet for {person.fullName}</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Click below and Signal Scout reads public sources (GitHub, talks, the web) and writes a short profile with
                facts you can cite, why this person would care, and a suggested opener for your first message.
              </p>
            </div>
            <RefreshDossier
              personId={person.id}
              name={person.fullName}
              company={companyName}
              hasDossier={false}
              onDone={reload}
            />
          </Card>
        )}
      </div>
    </>
  );
}
