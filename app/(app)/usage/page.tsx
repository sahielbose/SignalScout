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

  // Use UTC midnight so "today" here matches the UTC day the quota meters reset on.
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [todayCost] = await db
    .select({ cost: sql<number>`coalesce(sum(${llmRuns.costUsd}),0)`, calls: sql<number>`count(*)::int`, tokens: sql<number>`coalesce(sum(${llmRuns.tokens}),0)::int` })
    .from(llmRuns)
    .where(and(eq(llmRuns.orgId, orgId), gte(llmRuns.createdAt, todayStart)));

  const masked = byoKey ? `${byoKey.slice(0, 7)}…${byoKey.slice(-4)}` : null;
  const budget = env().GLOBAL_BUDGET_USD;

  return (
    <>
      <PageHeader
        title="Usage and limits"
        description="See how much of today's free allowance you have used, and add your own AI key to lift the daily cap."
      />
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <Reveal>
          <Card className="space-y-5 p-5">
            <div>
              <h2 className="text-sm font-semibold">What you have used today</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Signal Scout is free, with a daily allowance of AI work. The bars below fill up as you use it and reset
                every day at midnight UTC.
              </p>
            </div>
            <QuotaMeter
              label="Signals sorted"
              hint="Each new public buying moment we read and tag for you uses one of these."
              used={quota.classify.used}
              limit={quota.classify.limit}
            />
            <QuotaMeter
              label="Research profiles"
              hint="Each deep profile we build on a person, with sources, uses one of these. We reuse a profile for 7 days before building a fresh one."
              used={quota.research.used}
              limit={quota.research.limit}
            />
            <p className="text-xs text-muted-foreground">
              Run out for the day? Your allowance comes back tomorrow, or add your own AI key below to keep going right
              away.
              {budget > 0 ? ` There is also a shared daily spend ceiling of $${budget} across all free users.` : ''}
            </p>
          </Card>
        </Reveal>

        <div>
          <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today&apos;s AI cost so far
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="animate-fade-up p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: '0ms' }}>
              <div className="text-xs text-muted-foreground">Spent today</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">${(todayCost?.cost ?? 0).toFixed(2)}</div>
            </Card>
            <Card className="animate-fade-up p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: '50ms' }}>
              <div className="text-xs text-muted-foreground">AI requests today</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{(todayCost?.calls ?? 0).toLocaleString()}</div>
            </Card>
            <Card className="animate-fade-up p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: '100ms' }}>
              <div className="text-xs text-muted-foreground">Words processed today</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{(todayCost?.tokens ?? 0).toLocaleString()}</div>
            </Card>
          </div>
        </div>

        <Reveal delay={80}>
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Use your own AI key (optional)</h2>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">
              Add your own Anthropic key to remove the daily cap. The AI work then runs on your key and is billed to you,
              not to the shared free tier.
            </p>
            <ByoKey masked={masked} />
          </Card>
        </Reveal>
      </div>
    </>
  );
}
