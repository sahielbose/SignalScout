import { and, eq, gte, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { llmRuns } from '@/lib/db/schema';
import { getQuotaUsage } from '@/lib/quota/service';
import { getByoKey } from '@/lib/users/service';
import { env } from '@/lib/env';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { ByoKey, QuotaMeter } from '@/components/usage/byo-key';
import { Reveal } from '@/components/ui/reveal';

export const metadata = { title: 'Usage - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const user = await requireUser();
  const orgId = user.orgId!;
  const [quota, byoKey] = await Promise.all([getQuotaUsage(orgId), getByoKey(user.id)]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [todayCost] = await db
    .select({ cost: sql<number>`coalesce(sum(${llmRuns.costUsd}),0)`, calls: sql<number>`count(*)::int`, tokens: sql<number>`coalesce(sum(${llmRuns.tokens}),0)::int` })
    .from(llmRuns)
    .where(and(eq(llmRuns.orgId, orgId), gte(llmRuns.createdAt, todayStart)));

  const masked = byoKey ? `${byoKey.slice(0, 7)}…${byoKey.slice(-4)}` : null;
  const budget = env().GLOBAL_BUDGET_USD;

  return (
    <>
      <PageHeader title="Usage" description="Your free-tier meters today, model spend, and bring-your-own-key." />
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <Reveal>
          <Card className="space-y-5 p-5">
            <h2 className="text-sm font-semibold">Today&apos;s quota</h2>
            <QuotaMeter label="Classifications" used={quota.classify.used} limit={quota.classify.limit} />
            <QuotaMeter label="Deep-research dossiers" used={quota.research.used} limit={quota.research.limit} />
            <p className="text-xs text-muted-foreground">
              Quotas reset daily (UTC). Classification uses a cheap model; dossiers use a stronger one and are cached for 7 days.
              {budget > 0 ? ` Global daily budget ceiling: $${budget}.` : ''}
            </p>
          </Card>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="animate-fade-up p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: '0ms' }}>
            <div className="text-xs text-muted-foreground">Model spend today</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">${(todayCost?.cost ?? 0).toFixed(4)}</div>
          </Card>
          <Card className="animate-fade-up p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: '50ms' }}>
            <div className="text-xs text-muted-foreground">Model calls today</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{todayCost?.calls ?? 0}</div>
          </Card>
          <Card className="animate-fade-up p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: '100ms' }}>
            <div className="text-xs text-muted-foreground">Tokens today</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{(todayCost?.tokens ?? 0).toLocaleString()}</div>
          </Card>
        </div>

        <Reveal delay={80}>
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Bring your own API key</h2>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">
              Power users can supply an Anthropic key to bypass the shared quota and pay their own way.
            </p>
            <ByoKey masked={masked} />
          </Card>
        </Reveal>
      </div>
    </>
  );
}
