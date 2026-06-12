import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { companies, signals, people } from '@/lib/db/schema';

export async function listCompaniesWithCounts(limit = 100): Promise<
  { id: string; name: string | null; domain: string | null; signals: number; lastAt: Date | null }[]
> {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
      signals: sql<number>`count(${signals.id})::int`,
      lastAt: sql<Date | null>`max(coalesce(${signals.publishedAt}, ${signals.ingestedAt}))`,
    })
    .from(companies)
    .leftJoin(signals, eq(signals.companyId, companies.id))
    .groupBy(companies.id)
    .orderBy(desc(sql`count(${signals.id})`))
    .limit(limit);
}

export function inferDepartment(title?: string | null): string {
  const t = (title ?? '').toLowerCase();
  if (/\b(ceo|cto|cfo|coo|founder|chief|president)\b/.test(t)) return 'Leadership';
  if (/\b(sales|account exec|revenue|gtm|go-to-market|business develop|partnership|customer success|sdr|bdr)\b/.test(t)) return 'Go-to-Market';
  if (/\b(engineer|developer|infra|backend|frontend|sre|devops|data|ml|ai|security|platform)\b/.test(t)) return 'Engineering';
  if (/\b(product|design|ux|ui)\b/.test(t)) return 'Product & Design';
  if (/\b(market|growth|brand|content|demand)\b/.test(t)) return 'Marketing';
  if (/\b(finance|account|legal|people|hr|recruit|ops|operations|talent)\b/.test(t)) return 'Operations';
  return 'Other';
}

export interface CompanyProfile {
  company: typeof companies.$inferSelect;
  timeline: {
    id: string;
    type: string | null;
    strength: number | null;
    title: string | null;
    source: string;
    url: string | null;
    publishedAt: Date | null;
    ingestedAt: Date;
  }[];
  byType: { type: string; count: number }[];
  departments: { name: string; people: { id: string; name: string; title: string | null }[] }[];
}

export async function getCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return null;

  const timeline = await db
    .select({
      id: signals.id,
      type: signals.type,
      strength: signals.strength,
      title: signals.title,
      source: signals.source,
      url: signals.sourceUrl,
      publishedAt: signals.publishedAt,
      ingestedAt: signals.ingestedAt,
    })
    .from(signals)
    .where(eq(signals.companyId, companyId))
    .orderBy(desc(sql`coalesce(${signals.publishedAt}, ${signals.ingestedAt})`))
    .limit(100);

  const byTypeRows = await db
    .select({ type: signals.type, count: sql<number>`count(*)::int` })
    .from(signals)
    .where(eq(signals.companyId, companyId))
    .groupBy(signals.type);
  const byType = byTypeRows
    .filter((r): r is { type: string; count: number } => !!r.type)
    .sort((a, b) => b.count - a.count);

  const peopleRows = await db
    .select({ id: people.id, name: people.fullName, title: people.title })
    .from(people)
    .where(eq(people.companyId, companyId))
    .orderBy(desc(people.confidence));

  const deptMap = new Map<string, { id: string; name: string; title: string | null }[]>();
  for (const p of peopleRows) {
    const d = inferDepartment(p.title);
    if (!deptMap.has(d)) deptMap.set(d, []);
    deptMap.get(d)!.push(p);
  }
  const ORDER = ['Leadership', 'Go-to-Market', 'Engineering', 'Product & Design', 'Marketing', 'Operations', 'Other'];
  const departments = ORDER.filter((d) => deptMap.has(d)).map((name) => ({ name, people: deptMap.get(name)! }));

  return { company, timeline, byType, departments };
}
