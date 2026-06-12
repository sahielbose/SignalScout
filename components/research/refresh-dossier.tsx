'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, FileSearch } from 'lucide-react';
import { researchAction } from '@/lib/research/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';

export function RefreshDossier({
  personId,
  name,
  company,
  hasDossier,
}: {
  personId: string;
  name: string;
  company?: string | null;
  hasDossier: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [, setDone] = useState(false);

  const run = () =>
    start(async () => {
      const r = await researchAction({ personId, name, company: company ?? undefined, force: true });
      if (r.ok) {
        toast('Dossier refreshed', 'success');
        setDone(true);
        router.refresh();
      } else {
        toast(r.error ?? 'Research failed', 'error');
      }
    });

  return (
    <Button variant={hasDossier ? 'outline' : 'default'} size="sm" onClick={run} disabled={pending}>
      {hasDossier ? <RefreshCw className={pending ? 'animate-spin' : ''} /> : <FileSearch />}
      {pending ? 'Researching…' : hasDossier ? 'Refresh dossier' : 'Run deep research'}
    </Button>
  );
}
