import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { organizations } from '@/lib/db/schema';
import { Sidebar } from '@/components/app/sidebar';
import { UserMenu } from '@/components/app/user-menu';
import { Toaster } from '@/components/ui/toaster';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  let orgName = 'Workspace';
  if (user.orgId) {
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);
    if (org) orgName = org.name;
  }

  return (
    <div className="theme-warm flex h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end border-b bg-card/40 px-4">
          <UserMenu email={user.email ?? 'you'} orgName={orgName} />
        </header>
        <main className="scroll-thin flex-1 overflow-y-auto">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
