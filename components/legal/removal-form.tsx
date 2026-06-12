'use client';

import { useState, useTransition } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { requestDataRemovalAction } from '@/lib/legal/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function RemovalForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 text-primary" />
        <p>Request received. The operator will verify your identity and respond within the statutory window (30 days GDPR / 45 days CCPA).</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await requestDataRemovalAction({ email, name, note });
          if (r.ok) setDone(true);
          else setError(r.error ?? 'Something went wrong.');
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Your email (for verification)</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name to remove</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name as it might appear" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Details (optional)</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Company, profile URLs, or anything that helps us locate the record." />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null} Submit removal request
      </Button>
    </form>
  );
}
