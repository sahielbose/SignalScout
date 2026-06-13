'use client';

import { useState, useTransition } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Sparkles, Loader2, X, KeyRound } from 'lucide-react';
import {
  summarizeFeedAction,
  summarizeCompaniesAction,
  summarizeListAction,
} from '@/lib/summarize/actions';
import type { SummaryResult } from '@/lib/summarize/service';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';

type Surface =
  | { surface?: 'feed' }
  | { surface: 'companies' }
  | { surface: 'list'; listId: string };

const COPY: Record<'feed' | 'companies' | 'list', { title: string; blurb: string; tip: string }> = {
  feed: {
    title: 'Feed summary',
    blurb: 'A plain-English digest of the signals currently in your feed view.',
    tip: 'Read the cards in view and write a plain-English summary',
  },
  companies: {
    title: 'Companies summary',
    blurb: 'A plain-English digest of the companies showing buying signals right now.',
    tip: 'Read the companies in view and write a plain-English summary',
  },
  list: {
    title: 'List summary',
    blurb: 'A plain-English digest of the people and companies saved in this list.',
    tip: 'Read everything saved here and write a plain-English summary',
  },
};

/**
 * Reads the cards on the current surface (feed, companies, or a list) and writes
 * a plain-English digest, so a long list makes sense at a glance. Uses the user's
 * own AI key when set. Defaults to the feed for backward compatibility.
 */
export function SummarizeButton(props: Surface = { surface: 'feed' }) {
  const surface = props.surface ?? 'feed';
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<SummaryResult | null>(null);
  const [pending, start] = useTransition();
  const copy = COPY[surface];

  const run = () => {
    setRes(null);
    setOpen(true);
    start(async () => {
      let r: SummaryResult;
      if (surface === 'companies') {
        r = await summarizeCompaniesAction();
      } else if (surface === 'list') {
        r = await summarizeListAction((props as { listId: string }).listId);
      } else {
        const search = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
        r = await summarizeFeedAction(search);
      }
      setRes(r);
      if (!r.ok) toast(r.error ?? 'Could not summarize', 'error');
    });
  };

  const nounFor = (n: number) =>
    surface === 'companies'
      ? `compan${n === 1 ? 'y' : 'ies'}`
      : surface === 'list'
        ? `entr${n === 1 ? 'y' : 'ies'}`
        : `signal${n === 1 ? '' : 's'}`;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={run} disabled={pending} title={copy.tip}>
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Summarize
      </Button>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 animate-scale-in rounded-lg border bg-popover p-5 text-popover-foreground shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> {copy.title}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">{copy.blurb}</Dialog.Description>
          <div className="mt-4 min-h-[6rem]">
            {pending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Reading the cards and writing a summary
              </div>
            ) : res?.ok && res.summary ? (
              <>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{res.summary}</p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {res.count} {nounFor(res.count ?? 0)} summarized.
                  </span>
                  {res.usingOwnKey ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <KeyRound className="size-3" /> using your AI key
                    </span>
                  ) : null}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{res?.error ?? 'No summary available.'}</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
