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
        toast(`Feed populated${r.ingested ? ` · ${r.ingested} signals ingested` : ''}`, 'success');
        router.refresh();
      } else toast(r.error ?? 'Could not seed', 'error');
    });

  const steps = [
    { icon: Crosshair, title: 'Define who you sell to', body: 'An ICP - industries, titles, keywords, and which signal types matter.' },
    { icon: Radar, title: 'Watch the feed fill', body: 'Public signals from free sources get classified and matched to your ICP.' },
    { icon: FileSearch, title: 'Research a person', body: 'Generate a cited dossier on anyone - every fact carries a source.' },
  ];

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card className="radar-grid animate-scale-in p-8">
        <div className="flex size-11 animate-pop items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Radar className="size-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Let&apos;s populate your feed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasIcp
            ? 'Your ICP is set - pull in some live signals to see it in action.'
            : 'Two ways to start: seed a sample setup in one click, or define your own ICP.'}
        </p>

        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex animate-fade-up gap-3" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{i + 1}</div>
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
            {pending ? 'Seeding…' : 'Seed a sample ICP & signals'}
          </Button>
          <Button
            asChild
            variant="outline"
            className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
          >
            <Link href="/icps">Define my own ICP</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
