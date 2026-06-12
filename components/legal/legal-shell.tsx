import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Wordmark } from '@/components/brand/logo';

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/">
          <Wordmark />
        </Link>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Home
        </Link>
      </header>
      <article className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="prose-sm mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_code]:text-foreground">
          {children}
        </div>
        <p className="mt-10 rounded-md border border-beacon/30 bg-beacon/5 p-3 text-xs text-beacon/90">
          This is a template provided with the open-source project, not legal advice. Have counsel review and adapt it
          before operating Signal Scout for real users.
        </p>
      </article>
    </main>
  );
}
