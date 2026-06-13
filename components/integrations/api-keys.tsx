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

function RevokeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const revoke = () => {
    if (!confirm('Revoke this key? Any app using it will immediately lose access.')) return;
    start(async () => {
      const form = new FormData();
      form.set('id', id);
      await revokeKeyAction(form);
      toast('Key revoked', 'success');
    });
  };
  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      disabled={pending}
      onClick={revoke}
      className="text-destructive transition-all duration-200 active:scale-[0.97]"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Revoke
    </Button>
  );
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
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Name for your new API key"
          placeholder="Name it so you remember where it's used (e.g. production)"
        />
        <Button onClick={create} disabled={pending} className="shrink-0 transition-all duration-200 hover:shadow-md active:scale-[0.98]">
          {pending ? <Loader2 className="animate-spin" /> : <Plus />} Create key
        </Button>
      </div>

      {fresh && (
        <div className="animate-scale-in rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary">Copy this key now. For your security we won&apos;t show it again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">{fresh}</code>
            <Button
              size="icon"
              variant="outline"
              onClick={copy}
              aria-label={copied ? 'Key copied' : 'Copy key'}
              title={copied ? 'Copied' : 'Copy key'}
              className="size-8 shrink-0 transition-all duration-200 hover:shadow-md active:scale-[0.96]"
            >
              {copied ? <Check className="size-3.5 animate-pop text-primary" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y rounded-md border">
        {keys.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">No keys yet.</p>
            <p className="mt-0.5 text-xs">Name a key above and select Create key to get started. You&apos;ll need one to connect Claude, Cursor, or your own scripts.</p>
          </div>
        ) : (
          keys.map((k, i) => (
            <div key={k.id} className="flex animate-fade-up items-center gap-3 p-3 transition-colors hover:bg-muted/40" style={{ animationDelay: `${i * 50}ms` }}>
              <KeyRound className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{k.name}</span>
                  {k.revokedAt && <Badge variant="muted">revoked</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{k.prefix}…</span>{' '}
                  <span className="text-muted-foreground/70">
                    · {k.lastUsedAt ? `last used ${relativeTime(k.lastUsedAt)}` : 'not used yet'}
                  </span>
                </div>
              </div>
              {!k.revokedAt && <RevokeButton id={k.id} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
