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
import { cn, relativeTime, truncate, plainText, stripDashes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StrengthInfo } from './strength-info';
import { toast } from '@/lib/toast';

function cleanSummary(item: FeedItem): string {
  const raw = (item.summary ?? '').replace(/^Content change detected on [^:]+:\s*/i, '');
  // Source bodies are often markdown changelogs or release notes; flatten to clean
  // prose so cards never show raw "### Misc Changes - [codemod]" style noise.
  // stripDashes also keeps external titles within house style (no em/en dashes).
  return stripDashes(truncate(plainText(raw), 200));
}

const STATUS_LABELS: Record<Exclude<SignalStatusValue, 'open'>, string> = {
  actioned: 'Actioned',
  snoozed: 'Snoozed',
  dismissed: 'Dismissed',
};

export function SignalCard({
  item,
  density = 'comfortable',
  icpNames,
  onAddToList,
  onCleared,
  onReopened,
}: {
  item: FeedItem;
  /** Compact tightens spacing and hides the secondary "why this matched" line. */
  density?: 'comfortable' | 'compact';
  /** Map of the org's ICP id to its name, to label which customer type matched. */
  icpNames?: Record<string, string>;
  onAddToList?: (item: FeedItem) => void;
  /** Called after the signal is dismissed/snoozed/actioned (to remove/refresh it). */
  onCleared?: (item: FeedItem) => void;
  /** Called after the signal is reopened. */
  onReopened?: (item: FeedItem) => void;
}) {
  const compact = density === 'compact';
  const style = styleFor(item.type);
  const Icon = style.icon;
  const tone = strengthTone(item.strength);
  const subject = stripDashes(item.companyName || item.personName || 'Unknown');
  const when = item.publishedAt ?? item.ingestedAt;
  const typeLabel = item.type ? SIGNAL_TYPE_LABELS[item.type as SignalType] : 'Signal';
  const sourceLabel = SOURCE_LABELS[item.source as SourceName] ?? item.source;
  const pct = Math.round((item.strength ?? 0) * 100);
  const [pending, startTransition] = useTransition();
  const isCleared = item.status !== 'open';
  // Names of the customer types (ICPs) this signal matched, for the strength explainer.
  const matchedNames = icpNames
    ? item.matchedIcpIds.map((id) => icpNames[id]).filter((n): n is string => Boolean(n))
    : [];
  // House style: strip em/en dashes from any external text we display.
  const titleText = item.title ? stripDashes(item.title) : null;
  const justification = item.justification ? stripDashes(item.justification) : null;

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
    <article className={cn('rounded-lg border border-l-2 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md', compact ? 'p-3' : 'p-4', style.border, isCleared && 'opacity-75')}>
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
        <StrengthInfo
          pct={pct}
          strong={!!item.strength && item.strength >= 0.7}
          toneCls={tone.cls}
          typeLabel={typeLabel}
          sourceLabel={sourceLabel}
          justification={justification}
          matchedNames={matchedNames}
        />
      </div>

      <div className={cn(compact ? 'mt-2' : 'mt-3')}>
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
        {titleText && <p className="mt-0.5 text-sm font-medium">{titleText}</p>}
        <p className={cn('mt-1 text-sm text-muted-foreground', compact && 'line-clamp-2')}>{cleanSummary(item)}</p>
        {!compact && justification && (
          <p className="mt-2 text-xs italic text-muted-foreground/80">{justification}</p>
        )}
      </div>

      <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'mt-2' : 'mt-3')}>
        <Button asChild size="sm" variant="secondary">
          <Link
            href={
              item.personId
                ? `/people/${item.personId}`
                : `/research?company=${encodeURIComponent(subject)}${item.companyDomain ? `&domain=${item.companyDomain}` : ''}`
            }
            title="Build a research profile with cited sources for this contact or company"
          >
            <FileSearch className="size-3.5" /> Deep research
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAddToList?.(item)} title="Save this company or person to a list">
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
