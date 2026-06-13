'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Radar, Crosshair, FileSearch, Sparkles, Loader2 } from 'lucide-react';
import { seedSampleAction } from '@/lib/onboarding/actions';
import { toast } from '@/lib/toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function OnboardingCard({ hasIcp }: { hasIcp: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const seed = () =>
    start(async () => {
      const r = await seedSampleAction();
      if (r.ok) {
        toast(
          `Feed populated${r.ingested ? ` and ${r.ingested} signals added` : ''}`,
          'success',
        );
        router.refresh();
      } else toast(r.error ?? 'Could not seed', 'error');
    });

  const steps = [
    {
      icon: Crosshair,
      title: 'Tell us who you sell to',
      body: 'Set up an ICP: the kind of customer you sell to (industries, job titles, and keywords). This is what we watch for.',
    },
    {
      icon: Radar,
      title: 'Watch your feed fill up',
      body: 'We scan free, public sources for buying signals (public moments that suggest a company is ready to buy) and match them to your ICP.',
    },
    {
      icon: FileSearch,
      title: 'Research a person',
      body: 'Build a dossier (a research profile where every fact links back to its source) on anyone worth reaching out to.',
    },
  ];

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card className="radar-grid animate-scale-in p-8">
        <div className="flex size-11 animate-pop items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Radar className="size-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Welcome to Signal Scout</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasIcp
            ? 'You have already said who you sell to. Pull in some live signals to see your feed in action.'
            : 'This feed shows public buying signals about the customers you sell to. Three quick steps to get it started:'}
        </p>

        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="flex animate-fade-up gap-3"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {i + 1}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <s.icon className="size-3.5 text-primary" /> {s.title}
                </div>
                <p className="text-xs text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            onClick={seed}
            disabled={pending}
            className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
          >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? 'Setting up your feed' : 'Set up a sample feed in one click'}
          </Button>
          <Button
            asChild
            variant="outline"
            className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
          >
            <Link href="/icps">{hasIcp ? 'Edit who I sell to' : 'Set up who I sell to'}</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          New here? The one-click option fills your feed with example data so you can look around. You
          can clear it anytime.
        </p>
      </Card>
    </div>
  );
}
