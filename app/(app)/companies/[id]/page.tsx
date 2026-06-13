import { notFound } from 'next/navigation';
import { Users, ExternalLink, Radar } from 'lucide-react';
import { requireOrgId } from '@/lib/auth/session';
import { getCompanyProfile } from '@/lib/companies/queries';
import { SIGNAL_TYPE_LABELS, SOURCE_LABELS, type SignalType, type SourceName } from '@/lib/types';
import { styleFor } from '@/lib/feed/signal-style';
import { PageHeader } from '@/components/app/page-header';
import { OrgTree } from '@/components/companies/org-tree';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const profile = await getCompanyProfile(orgId, id);
  if (!profile) notFound();
  const { company, timeline, byType, people } = profile;

  return (
    <>
      <PageHeader
        title={company.name ?? company.domain ?? 'Company'}
        description="Everything we are watching at this company: each public buying sign over time, and the people who work here grouped by team."
      >
        {company.domain && (
          <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ExternalLink className="size-3.5" /> {company.domain}
          </a>
        )}
      </PageHeader>

      <div className="mx-auto grid max-w-5xl gap-5 p-6 lg:grid-cols-3">
        {/* timeline */}
        <div className="lg:col-span-2">
          <div className="mb-1 flex animate-fade-in flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Buying signs over time</h2>
            {byType.map((t) => (
              <Badge key={t.type} variant="secondary">
                {SIGNAL_TYPE_LABELS[t.type as SignalType] ?? t.type}: {t.count}
              </Badge>
            ))}
          </div>
          <p className="mb-3 animate-fade-in text-xs text-muted-foreground">
            Each card is a public moment that suggests this company may be ready to buy. The percentage is how strong a buying sign it is.
          </p>
          {timeline.length === 0 ? (
            <Card className="animate-scale-in p-8 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Radar className="size-5" />
              </div>
              <p className="text-sm font-medium">No buying signs yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                We have not spotted a public buying sign here yet. New ones will appear in this timeline automatically as we find them.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {timeline.map((s, i) => {
                const style = styleFor(s.type);
                const Icon = style.icon;
                return (
                  <Card
                    key={s.id}
                    className={cn('flex animate-fade-up items-start gap-3 border-l-2 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md', style.border)}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md', style.badge)}>
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{s.type ? (SIGNAL_TYPE_LABELS[s.type as SignalType] ?? s.type) : 'Signal'}</span>
                        <span>{SOURCE_LABELS[s.source as SourceName] ?? s.source}</span>
                        <span>· {relativeTime(s.publishedAt ?? s.ingestedAt)}</span>
                        {s.strength != null && <span>· {Math.round(s.strength * 100)}% strength</span>}
                      </div>
                      <p className="mt-0.5 text-sm">{s.title}</p>
                    </div>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Open source">
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* people / org tree */}
        <div>
          <h2 className="mb-1 flex animate-fade-in items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4" /> People here
            {people.length > 0 && <Badge variant="secondary">{people.length}</Badge>}
          </h2>
          <p className="mb-3 animate-fade-in text-xs text-muted-foreground">
            People we have found at this company, grouped by team. Click a name to open their research profile.
          </p>
          <OrgTree people={people} />
        </div>
      </div>
    </>
  );
}
