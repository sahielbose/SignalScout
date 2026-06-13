'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, AlertTriangle } from 'lucide-react';
import { pushListToCrmAction } from '@/lib/crm/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';

/**
 * Stage-2 guardrail: CRM push is always a confirmed, audited action. The button
 * first opens a confirm dialog (the gate), then runs the server action and toasts
 * the summary. When no CRM is configured it renders disabled with a hint.
 */
export function CrmPush({
  listId,
  listName,
  peopleCount,
  configured,
  provider,
}: {
  listId: string;
  listName: string;
  peopleCount: number;
  configured: boolean;
  provider: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!configured) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        title="Connect a CRM in your environment to enable push"
      >
        <Upload className="size-4" /> Push to CRM
      </Button>
    );
  }

  const run = () =>
    start(async () => {
      const summary = await pushListToCrmAction(listId);
      setOpen(false);
      const variant = summary.failed > 0 ? 'error' : summary.pushed > 0 ? 'success' : 'default';
      toast(summary.message, variant);
      router.refresh();
    });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="size-4" /> Push to CRM
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 animate-fade-up"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm CRM push"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <AlertTriangle className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">Push to {provider}?</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This will send {peopleCount} {peopleCount === 1 ? 'person' : 'people'} from
                  {' '}
                  <span className="font-medium text-foreground">{listName}</span> to your CRM. This
                  action is logged. Companies and members without contact details are skipped.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={run} disabled={pending}>
                {pending ? 'Pushing…' : `Push ${peopleCount}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
