'use client';

import { use, useEffect, useState, useTransition } from 'react';
import { notFound } from 'next/navigation';
import { Sparkles, Lock, Loader2 } from 'lucide-react';
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
        <Button variant="outline" size="sm" disabled title="Set ENABLE_PAID_ENRICHMENT and a vendor key to turn this on.">
          <Lock />
          Enrich contact
        </Button>
        <span className="text-xs text-muted-foreground">off by default</span>
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
    <Button variant="outline" size="sm" onClick={run} disabled={pending} className="group hover:shadow-md">
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles className="transition-transform duration-300 group-hover:scale-110" />}
      {pending ? 'Enriching…' : 'Enrich contact'}
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

  return (
    <>
      <PageHeader
        title={person.fullName}
        description={[person.title, companyName, person.location].filter(Boolean).join(' · ') || undefined}
      >
        <EnrichButton personId={person.id} enabled={data.enrichmentEnabled} onEnriched={() => setNonce((n) => n + 1)} />
        <RefreshDossier personId={person.id} name={person.fullName} company={companyName} hasDossier={!!dossier} />
      </PageHeader>

      <div className="mx-auto max-w-3xl p-6">
        {dossier ? (
          <Card className="p-5">
            <DossierPanel
              dossier={dossier}
              personId={person.id}
              meta={meta ? { model: meta.model ?? undefined, cached: meta.cached } : undefined}
            />
          </Card>
        ) : (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No dossier yet for {person.fullName}. Run deep research to build a cited profile from public sources.
            </p>
            <RefreshDossier personId={person.id} name={person.fullName} company={companyName} hasDossier={false} />
          </Card>
        )}
      </div>
    </>
  );
}
