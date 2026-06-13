import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { organizations, users } from '@/lib/db/schema';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateOrgName, updateProfileName } from './actions';

export const metadata = { title: 'Settings - Signal Scout' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUser();
  // Both lookups are strictly scoped to the signed-in user's own org. If the
  // user has no org yet we skip the queries and render the empty states below.
  const [org] = user.orgId
    ? await db.select().from(organizations).where(eq(organizations.id, user.orgId)).limit(1)
    : [];
  const members = user.orgId
    ? await db
        .select({ id: users.id, email: users.email, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.orgId, user.orgId))
    : [];
  // The organization name can only be changed by an owner or admin. Everyone
  // else sees the name read-only. This matches the gate in actions.ts.
  const canEditOrg = user.role === 'owner' || user.role === 'admin';

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your workspace name, see who is on your team, and update your own name. A workspace is the shared account everyone on your team works inside."
        helper="Type a new name in a box, then press Save. Only a workspace owner or admin can rename the whole workspace; you can always change your own name."
      />
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        {/* Workspace card: the shared account that owns your customer types, feed, and research. */}
        <Card className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md">
          <h2 className="text-sm font-semibold">Workspace</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The shared account your whole team works in. Renaming it here changes the name everyone sees.
          </p>
          {canEditOrg ? (
            <form action={updateOrgName} className="mt-3 space-y-1.5">
              <Label htmlFor="org-name">Workspace name</Label>
              <div className="flex gap-2">
                <Input
                  id="org-name"
                  name="name"
                  defaultValue={org?.name ?? ''}
                  maxLength={80}
                  required
                  placeholder="e.g. Acme Sales"
                />
                <Button type="submit" variant="secondary">
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Workspace name</span>
                <span className="font-medium">{org?.name ?? '-'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Only a workspace owner or admin can change this name.
              </p>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Plan</span>
            <Badge variant="secondary">{org?.plan ?? 'free'}</Badge>
          </div>
        </Card>

        {/* Members card: read-only list of who shares this workspace. */}
        <Card
          className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md"
          style={{ animationDelay: '80ms' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Team members</h2>
            <span className="text-xs text-muted-foreground">
              {members.length} {members.length === 1 ? 'person' : 'people'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Everyone who can sign in to this workspace. The role badge shows what each person is allowed to do.
          </p>
          {members.length > 0 ? (
            <div className="mt-3 divide-y">
              {members.map((m, i) => (
                <div
                  key={m.id}
                  className="flex animate-fade-up items-center justify-between py-2 text-sm transition-colors hover:bg-muted/30"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div>
                    <div className="font-medium">
                      {m.name ?? m.email}
                      {m.id === user.id && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                  <Badge variant={m.role === 'owner' ? 'default' : 'muted'}>{m.role}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              You are the only person in this workspace right now. Invites are coming soon.
            </p>
          )}
        </Card>

        {/* Profile card: just this signed-in user's own details. */}
        <Card
          className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md"
          style={{ animationDelay: '160ms' }}
        >
          <h2 className="text-sm font-semibold">Your profile</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Just for you. This is the name your teammates see next to your activity.
          </p>
          <form action={updateProfileName} className="mt-3 space-y-1.5">
            <Label htmlFor="profile-name">Your name</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                name="name"
                defaultValue={user.name ?? ''}
                maxLength={80}
                required
                placeholder="e.g. Jordan Lee"
              />
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </div>
          </form>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Your role</dt>
              <dd className="font-medium">{user.role}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
