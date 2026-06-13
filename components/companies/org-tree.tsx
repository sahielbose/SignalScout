import Link from 'next/link';
import { Crown, Code2, Boxes, TrendingUp, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CompanyPerson } from '@/lib/companies/queries';

/**
 * Department taxonomy for the enterprise account org-tree. We bucket people by
 * title keywords - a cheap, deterministic grouping (no model call). "Other"
 * absorbs anything we cannot confidently place.
 */
type DeptKey = 'Leadership' | 'Engineering' | 'Product' | 'Sales and GTM' | 'Other';

const DEPT_META: Record<DeptKey, { icon: LucideIcon; accent: string }> = {
  Leadership: { icon: Crown, accent: 'text-beacon' },
  Engineering: { icon: Code2, accent: 'text-primary' },
  Product: { icon: Boxes, accent: 'text-primary' },
  'Sales and GTM': { icon: TrendingUp, accent: 'text-primary' },
  Other: { icon: Users, accent: 'text-muted-foreground' },
};

const DEPT_ORDER: DeptKey[] = ['Leadership', 'Engineering', 'Product', 'Sales and GTM', 'Other'];

function departmentFor(title: string | null): DeptKey {
  const t = (title ?? '').toLowerCase();
  if (/\b(founder|ceo|cto|cfo|coo|chief|vp|head|president)\b/.test(t)) return 'Leadership';
  if (/\b(engineer|developer|platform|infra|infrastructure|sre|devops|backend|frontend)\b/.test(t)) return 'Engineering';
  if (/\b(product|pm|design|ux|ui)\b/.test(t)) return 'Product';
  if (/\b(sales|ae|gtm|go-to-market|revenue|growth|marketing|market)\b/.test(t)) return 'Sales and GTM';
  return 'Other';
}

/** Lower number = more senior, so people sort to the top of their department. */
function seniorityRank(title: string | null): number {
  const t = (title ?? '').toLowerCase();
  if (/\b(founder|ceo|cfo|cto|coo|chief|president)\b/.test(t)) return 0;
  if (/\b(vp|vice president|svp|evp)\b/.test(t)) return 1;
  if (/\b(head|director)\b/.test(t)) return 2;
  if (/\b(lead|principal|staff|manager)\b/.test(t)) return 3;
  if (/\b(senior|sr\.?)\b/.test(t)) return 4;
  if (t.trim().length > 0) return 5;
  return 6; // untitled - last
}

export function OrgTree({ people }: { people: CompanyPerson[] }) {
  if (people.length === 0) {
    return (
      <Card className="animate-scale-in p-6 text-center">
        <Users className="mx-auto mb-2 size-5 text-muted-foreground" />
        <p className="text-xs font-medium">No people found here yet</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-xs text-muted-foreground">
          As you research people at this company, they will show up here grouped by team so you can see who to reach out to.
        </p>
      </Card>
    );
  }

  const buckets = new Map<DeptKey, CompanyPerson[]>();
  for (const p of people) {
    const dept = departmentFor(p.title);
    if (!buckets.has(dept)) buckets.set(dept, []);
    buckets.get(dept)!.push(p);
  }

  const departments = DEPT_ORDER.filter((d) => buckets.has(d)).map((name) => ({
    name,
    people: buckets
      .get(name)!
      .slice()
      .sort((a, b) => seniorityRank(a.title) - seniorityRank(b.title) || a.name.localeCompare(b.name)),
  }));

  return (
    <div className="space-y-3">
      {departments.map((d, i) => {
        const meta = DEPT_META[d.name];
        const Icon = meta.icon;
        return (
          <Card
            key={d.name}
            className="animate-fade-up p-3"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Icon className={`size-3.5 ${meta.accent}`} />
                {d.name}
              </div>
              <Badge variant="muted">{d.people.length}</Badge>
            </div>
            <ul className="space-y-1.5">
              {d.people.map((p) => (
                <li key={p.id} className="flex flex-col">
                  <Link
                    href={`/people/${p.id}`}
                    className="text-sm font-medium hover:text-primary hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.title && <span className="text-xs text-muted-foreground">{p.title}</span>}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
