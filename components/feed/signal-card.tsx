'use client';

import Link from 'next/link';
import { ExternalLink, FileSearch, ListPlus } from 'lucide-react';
import { SIGNAL_TYPE_LABELS, SOURCE_LABELS, type SignalType, type SourceName } from '@/lib/types';
import { styleFor, strengthTone } from '@/lib/feed/signal-style';
import type { FeedItem } from '@/lib/feed/queries';
import { cn, relativeTime, truncate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function cleanSummary(item: FeedItem): string {
  const raw = (item.summary ?? '').replace(/^Content change detected on [^:]+:\s*/i, '');
  // drop a leading "X is hiring: title" duplication if the title already covers it
  return truncate(raw.replace(/\s+/g, ' ').trim(), 200);
}

export function SignalCard({ item, onAddToList }: { item: FeedItem; onAddToList?: (item: FeedItem) => void }) {
  const style = styleFor(item.type);
  const Icon = style.icon;
  const tone = strengthTone(item.strength);
  const subject = item.companyName || item.personName || 'Unknown';
  const when = item.publishedAt ?? item.ingestedAt;
  const typeLabel = item.type ? SIGNAL_TYPE_LABELS[item.type as SignalType] : 'Signal';
  const sourceLabel = SOURCE_LABELS[item.source as SourceName] ?? item.source;
  const pct = Math.round((item.strength ?? 0) * 100);

  return (
    <article className={cn('rounded-lg border border-l-2 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md', style.border)}>
      <div className="flex items-center gap-2 text-xs">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium', style.badge)}>
          <Icon className="size-3" />
          {typeLabel}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{sourceLabel}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{relativeTime(when)}</span>
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

      <div className="mt-3 flex items-center gap-1.5">
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
