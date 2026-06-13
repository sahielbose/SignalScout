import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { organizations, users } from '@/lib/db/schema';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Settings - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUser();
  const [org] = user.orgId
    ? await db.select().from(organizations).where(eq(organizations.id, user.orgId)).limit(1)
    : [];
  const members = user.orgId
    ? await db.select({ id: users.id, email: users.email, name: users.name, role: users.role }).from(users).where(eq(users.orgId, user.orgId))
    : [];

  return (
    <>
      <PageHeader title="Settings" description="Your organization, members, and profile." />
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <Card className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md">
          <h2 className="text-sm font-semibold">Organization</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{org?.name ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Plan</dt>
              <dd><Badge variant="secondary">{org?.plan ?? 'free'}</Badge></dd>
            </div>
          </dl>
        </Card>

        <Card className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md" style={{ animationDelay: '80ms' }}>
          <h2 className="text-sm font-semibold">Members</h2>
          <div className="mt-3 divide-y">
            {members.map((m, i) => (
              <div
                key={m.id}
                className="flex animate-fade-up items-center justify-between py-2 text-sm transition-colors hover:bg-muted/30"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div>
                  <div className="font-medium">{m.name ?? m.email}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                <Badge variant={m.role === 'owner' ? 'default' : 'muted'}>{m.role}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md" style={{ animationDelay: '160ms' }}>
          <h2 className="text-sm font-semibold">Profile</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{user.role}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
