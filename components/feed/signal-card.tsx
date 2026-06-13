'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Check, Clock, ExternalLink, FileSearch, ListPlus, RotateCcw, X } from 'lucide-react';
import { SIGNAL_TYPE_LABELS, SOURCE_LABELS, type SignalType, type SourceName } from '@/lib/types';
import { styleFor, strengthTone } from '@/lib/feed/signal-style';
import type { FeedItem } from '@/lib/feed/queries';
import type { SignalStatusValue } from '@/lib/feed/status';
import {
  dismissSignalAction,
  snoozeSignalAction,
  markActionedAction,
  reopenSignalAction,
  type StatusActionResult,
} from '@/lib/feed/status-actions';
import { cn, relativeTime, truncate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';

function cleanSummary(item: FeedItem): string {
  const raw = (item.summary ?? '').replace(/^Content change detected on [^:]+:\s*/i, '');
  // drop a leading "X is hiring: title" duplication if the title already covers it
  return truncate(raw.replace(/\s+/g, ' ').trim(), 200);
}

const STATUS_LABELS: Record<Exclude<SignalStatusValue, 'open'>, string> = {
  actioned: 'Actioned',
  snoozed: 'Snoozed',
  dismissed: 'Dismissed',
};

export function SignalCard({
  item,
  onAddToList,
  onCleared,
  onReopened,
}: {
  item: FeedItem;
  onAddToList?: (item: FeedItem) => void;
  /** Called after the signal is dismissed/snoozed/actioned (to remove/refresh it). */
  onCleared?: (item: FeedItem) => void;
  /** Called after the signal is reopened. */
  onReopened?: (item: FeedItem) => void;
}) {
  const style = styleFor(item.type);
  const Icon = style.icon;
  const tone = strengthTone(item.strength);
  const subject = item.companyName || item.personName || 'Unknown';
  const when = item.publishedAt ?? item.ingestedAt;
  const typeLabel = item.type ? SIGNAL_TYPE_LABELS[item.type as SignalType] : 'Signal';
  const sourceLabel = SOURCE_LABELS[item.source as SourceName] ?? item.source;
  const pct = Math.round((item.strength ?? 0) * 100);
  const [pending, startTransition] = useTransition();
  const isCleared = item.status !== 'open';

  function runStatus(
    fn: () => Promise<StatusActionResult>,
    okMsg: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast(okMsg, 'success');
        after?.();
      } else {
        toast(r.error ?? 'Could not update signal', 'error');
      }
    });
  }

  return (
    <article className={cn('rounded-lg border border-l-2 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md', style.border, isCleared && 'opacity-75')}>
      <div className="flex items-center gap-2 text-xs">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium', style.badge)}>
          <Icon className="size-3" />
          {typeLabel}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{sourceLabel}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{relativeTime(when)}</span>
        {isCleared && (
          <Badge variant="muted" className="ml-1">
            {STATUS_LABELS[item.status as Exclude<SignalStatusValue, 'open'>]}
            {item.status === 'snoozed' && item.snoozedUntil
              ? ` · until ${new Date(item.snoozedUntil).toLocaleDateString()}`
              : ''}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2" title={`Signal strength ${pct}%`}>
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
            <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', item.strength && item.strength >= 0.7 ? 'bg-beacon' : 'bg-primary')} style={{ width: `${pct}%` }} />
          </div>
          <span className={cn('font-mono text-xs font-medium', tone.cls)}>{pct}%</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          {item.companyId ? (
            <Link href={`/companies/${item.companyId}`} className="font-semibold hover:text-primary hover:underline">
              {subject}
            </Link>
          ) : (
            <span className="font-semibold">{subject}</span>
          )}
          {item.companyDomain && <span className="text-xs text-muted-foreground">{item.companyDomain}</span>}
        </div>
        {item.title && <p className="mt-0.5 text-sm font-medium">{item.title}</p>}
        <p className="mt-1 text-sm text-muted-foreground">{cleanSummary(item)}</p>
        {item.justification && (
          <p className="mt-2 text-xs italic text-muted-foreground/80">{item.justification}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button asChild size="sm" variant="secondary">
          <Link
            href={
              item.personId
                ? `/people/${item.personId}`
                : `/research?company=${encodeURIComponent(subject)}${item.companyDomain ? `&domain=${item.companyDomain}` : ''}`
            }
          >
            <FileSearch className="size-3.5" /> Deep research
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAddToList?.(item)}>
          <ListPlus className="size-3.5" /> Add to list
        </Button>

        {isCleared ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              runStatus(() => reopenSignalAction(item.id), 'Signal reopened', () => onReopened?.(item))
            }
          >
            <RotateCcw className="size-3.5" /> Reopen
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              title="Mark actioned"
              onClick={() =>
                runStatus(() => markActionedAction(item.id), 'Marked actioned', () => onCleared?.(item))
              }
            >
              <Check className="size-3.5" /> Actioned
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              title="Snooze for 7 days"
              onClick={() =>
                runStatus(() => snoozeSignalAction(item.id, 7), 'Snoozed for 7 days', () => onCleared?.(item))
              }
            >
              <Clock className="size-3.5" /> Snooze 7d
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              title="Dismiss"
              onClick={() =>
                runStatus(() => dismissSignalAction(item.id), 'Signal dismissed', () => onCleared?.(item))
              }
            >
              <X className="size-3.5" /> Dismiss
            </Button>
          </>
        )}

        {item.sourceUrl && (
          <Button asChild size="icon" variant="ghost" className="ml-auto size-8" title="Open source">
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
