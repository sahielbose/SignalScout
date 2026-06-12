'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Github, Mail, Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = { github: boolean; email: boolean; dev: boolean };

export function LoginForm({ github, email, dev }: Props) {
  const [magicEmail, setMagicEmail] = useState('');
  const [devEmail, setDevEmail] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const start = (key: string, fn: () => Promise<unknown>) => async () => {
    setPending(key);
    try {
      await fn();
    } finally {
      setPending(null);
    }
  };

  const none = !github && !email && !dev;

  return (
    <div className="flex flex-col gap-4">
      {github && (
        <Button
          variant="secondary"
          size="lg"
          disabled={!!pending}
          onClick={start('github', () => signIn('github', { redirectTo: '/feed' }))}
        >
          {pending === 'github' ? <Loader2 className="animate-spin" /> : <Github />}
          Continue with GitHub
        </Button>
      )}

      {email && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            start('email', async () => {
              await signIn('nodemailer', { email: magicEmail, redirectTo: '/feed' });
              setSent(true);
            })();
          }}
        >
          <Label htmlFor="magic">Email magic link</Label>
          <div className="flex gap-2">
            <Input
              id="magic"
              type="email"
              required
              placeholder="you@company.com"
              value={magicEmail}
              onChange={(ev) => setMagicEmail(ev.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!!pending}>
              {pending === 'email' ? <Loader2 className="animate-spin" /> : <Mail />}
              Send
            </Button>
          </div>
          {sent && <p className="text-xs text-primary">Check your inbox for a sign-in link.</p>}
        </form>
      )}

      {dev && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-beacon/40 bg-beacon/5 p-3">
          <Label htmlFor="dev" className="flex items-center gap-1.5 text-beacon">
            <Terminal className="size-3.5" /> Developer sign-in (no keys needed)
          </Label>
          <form
            className="flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              start('dev', () => signIn('dev', { email: devEmail, redirectTo: '/feed' }))();
            }}
          >
            <Input
              id="dev"
              type="email"
              required
              placeholder="dev@example.com"
              value={devEmail}
              onChange={(ev) => setDevEmail(ev.target.value)}
            />
            <Button type="submit" variant="beacon" disabled={!!pending}>
              {pending === 'dev' ? <Loader2 className="animate-spin" /> : null}
              Enter
            </Button>
          </form>
        </div>
      )}

      {none && (
        <p className="text-sm text-muted-foreground">
          No auth providers configured. Set <code className="text-foreground">AUTH_GITHUB_ID</code> /{' '}
          <code className="text-foreground">SMTP_URL</code> in <code className="text-foreground">.env</code>,
          or run in development for password-less sign-in.
        </p>
      )}
    </div>
  );
}
