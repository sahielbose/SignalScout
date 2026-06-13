import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MarketingLogo } from '@/components/marketing/marketing-logo';
import { LoginForm } from '@/components/auth/login-form';
import { auth, DEV_LOGIN_ENABLED } from '@/lib/auth';
import { env } from '@/lib/env';

export const metadata = { title: 'Sign in - SignalScout' };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/feed');

  const e = env();
  const github = !!(e.AUTH_GITHUB_ID && e.AUTH_GITHUB_SECRET);
  const email = !!e.SMTP_URL;

  return (
    <main className="marketing grid min-h-screen font-sans lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex">
        <div className="paper-dots pointer-events-none absolute inset-0 -z-10" />
        <Link href="/">
          <MarketingLogo />
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight">
            Catch the signal before your competitors hear the noise.
          </h2>
          <p className="mt-4 text-[hsl(var(--muted-foreground))]">
            Define who you sell to, and SignalScout surfaces the public moments that make them a buyer, then hands you a
            cited dossier on the person to reach.
          </p>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Free, open source, built on public data. No LinkedIn scraping.
        </p>
      </section>

      <section className="flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/">
              <MarketingLogo />
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Welcome back. Choose how you would like to continue.
          </p>
          <div className="mt-6">
            <LoginForm github={github} email={email} dev={DEV_LOGIN_ENABLED} />
          </div>
          <p className="mt-8 text-xs text-[hsl(var(--muted-foreground))]">
            By continuing you agree to use only public data responsibly.{' '}
            <Link href="/" className="text-[hsl(var(--accent))] underline-offset-4 hover:underline">
              Back home
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
