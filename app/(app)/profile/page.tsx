import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  FileSearch,
  KeyRound,
  ListChecks,
  Radio,
  Target,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getProfileData, updateMyName } from './actions';

export const dynamic = 'force-dynamic';

function firstNameOf(name: string | null, email: string | null): string {
  if (name && name.trim()) return name.trim().split(/\s+/)[0]!;
  if (email) return email.split('@')[0]!;
  return 'there';
}

function initialsOf(name: string | null, email: string | null): string {
  const src = (name && name.trim()) || email || '?';
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

export default async function ProfilePage() {
  const data = await getProfileData();
  const first = firstNameOf(data.user.name, data.user.email);
  const initials = initialsOf(data.user.name, data.user.email);

  const stats: { label: string; value: number; href: string; icon: typeof Target; hint: string }[] = [
    { label: 'Customer types', value: data.icps.length, href: '/icps', icon: Target, hint: 'the kinds of customer you watch for' },
    { label: 'Companies tracked', value: data.stats.companies, href: '/companies', icon: Building2, hint: 'companies showing a buying sign' },
    { label: 'Signals matched', value: data.stats.signals, href: '/feed', icon: Radio, hint: 'public buying moments kept for you' },
    { label: 'Lists', value: data.stats.lists, href: '/lists', icon: ListChecks, hint: 'saved groups of people and companies' },
    { label: 'Research profiles', value: data.stats.dossiers, href: '/research', icon: FileSearch, hint: 'sourced write-ups you have built' },
    { label: 'Team members', value: data.stats.members, href: '/settings', icon: Users, hint: 'people in your workspace' },
  ];

  return (
    <>
      <PageHeader
        title="Your profile"
        description={`Hi ${first}. This is you and your workspace at a glance, with everything Signal Scout has tailored to the customers you sell to.`}
      />

      <div className="mx-auto max-w-4xl space-y-5 p-6">
        {/* Identity */}
        <Card className="animate-fade-up p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{data.user.name ?? first}</h2>
                <Badge variant="secondary" className="capitalize">
                  {data.user.role}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{data.user.email ?? 'No email on file'}</p>
              <p className="mt-2 text-sm">
                <span className="text-muted-foreground">Workspace: </span>
                <span className="font-medium">{data.org?.name ?? 'No workspace yet'}</span>
                {data.org?.plan && (
                  <Badge variant="muted" className="ml-2 capitalize">
                    {data.org.plan} plan
                  </Badge>
                )}
              </p>
            </div>
          </div>

          {/* Edit your display name (just for you; teammates see it on your activity). */}
          <form action={updateMyName} className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="my-name">Your name</Label>
              <Input
                id="my-name"
                name="name"
                defaultValue={data.user.name ?? ''}
                maxLength={80}
                required
                placeholder="e.g. Jordan Lee"
                className="w-56"
              />
            </div>
            <Button type="submit" variant="secondary">
              Save name
            </Button>
            <Link
              href="/settings"
              className="ml-auto self-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Workspace and team settings
            </Link>
          </form>
        </Card>

        {/* Personalized stats */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Your workspace at a glance</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.label}
                  href={s.href}
                  className="group animate-fade-up rounded-lg border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md"
                  style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="size-4" />
                    <span className="text-xs font-medium">{s.label}</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value.toLocaleString()}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Customer types this person is selling into */}
        <Card className="animate-fade-up p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Target className="size-4" /> The customers you sell to
            </h3>
            <Link
              href="/icps"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Manage
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your feed, companies, and research are all filtered to these. The strength score on every signal is how well
            it matches one of them.
          </p>
          {data.icps.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.icps.map((icp) => (
                <Link
                  key={icp.id}
                  href="/icps"
                  className="inline-flex items-center gap-1 rounded-full border border-input bg-background px-3 py-1 text-xs font-medium transition-colors hover:border-ring/60 hover:text-foreground"
                >
                  {icp.name}
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              You have not defined a customer type yet.{' '}
              <Link href="/icps" className="font-medium text-primary hover:underline">
                Add one
              </Link>{' '}
              so Signal Scout knows who to watch for.
            </div>
          )}
        </Card>

        {/* AI key status */}
        <Card className="animate-fade-up p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-semibold">Your AI key</h3>
                {data.byoKey ? (
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-primary">
                    <CheckCircle2 className="size-3.5" /> Active. Your research, email drafts, and summaries run on your
                    own key with no daily cap.
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Not set. You are on the shared free tier with a daily allowance.
                  </p>
                )}
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/usage">{data.byoKey ? 'Manage key' : 'Add your key'}</Link>
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
