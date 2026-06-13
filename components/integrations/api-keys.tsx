'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Plus, Copy, Check, Loader2 } from 'lucide-react';
import { createKeyAction, revokeKeyAction } from '@/lib/apikeys/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';

export interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export function ApiKeys({ keys }: { keys: KeyRow[] }) {
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const r = await createKeyAction(name || 'API key');
      if (r.ok && r.key) {
        setFresh(r.key);
        setName('');
      } else toast(r.error ?? 'Could not create key', 'error');
    });

  const copy = async () => {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. production)" />
        <Button onClick={create} disabled={pending} className="transition-all duration-200 hover:shadow-md active:scale-[0.98]">
          {pending ? <Loader2 className="animate-spin" /> : <Plus />} New key
        </Button>
      </div>

      {fresh && (
        <div className="animate-scale-in rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary">Copy this key now - it won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">{fresh}</code>
            <Button size="icon" variant="outline" onClick={copy} className="size-8 transition-all duration-200 hover:shadow-md active:scale-[0.96]">
              {copied ? <Check className="size-3.5 animate-pop text-primary" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y rounded-md border">
        {keys.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          keys.map((k, i) => (
            <div key={k.id} className="flex animate-fade-up items-center gap-3 p-3 transition-colors hover:bg-muted/40" style={{ animationDelay: `${i * 50}ms` }}>
              <KeyRound className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{k.name}</span>
                  {k.revokedAt && <Badge variant="muted">revoked</Badge>}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {k.prefix}…··· · {k.lastUsedAt ? `used ${relativeTime(k.lastUsedAt)}` : 'never used'}
                </div>
              </div>
              {!k.revokedAt && (
                <form action={revokeKeyAction}>
                  <input type="hidden" name="id" value={k.id} />
                  <Button variant="ghost" size="sm" type="submit" className="text-destructive">
                    Revoke
                  </Button>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
