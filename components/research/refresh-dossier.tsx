'use client';

import { useTransition } from 'react';
import { RefreshCw, FileSearch } from 'lucide-react';
import { researchAction } from '@/lib/research/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';

export function RefreshDossier({
  personId,
  name,
  company,
  hasDossier,
  onDone,
}: {
  personId: string;
  name: string;
  company?: string | null;
  hasDossier: boolean;
  /** Called after a successful run so the page can reload the new profile. */
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const r = await researchAction({ personId, name, company: company ?? undefined, force: true });
      if (r.ok) {
        toast(hasDossier ? 'Profile updated with fresh sources' : 'Research profile built', 'success');
        onDone?.();
      } else {
        toast(r.error ?? 'Could not build the profile. Try again.', 'error');
      }
    });

  return (
    <Button
      variant={hasDossier ? 'outline' : 'default'}
      size="sm"
      onClick={run}
      disabled={pending}
      className="group hover:shadow-md"
      title={
        hasDossier
          ? 'Search public sources again and rebuild this research profile'
          : 'Search public sources and build a research profile for this person'
      }
    >
      {hasDossier ? (
        <RefreshCw className={pending ? 'animate-spin' : 'transition-transform duration-300 group-hover:rotate-90'} />
      ) : (
        <FileSearch />
      )}
      {pending ? 'Researching…' : hasDossier ? 'Refresh profile' : 'Build research profile'}
    </Button>
  );
}
