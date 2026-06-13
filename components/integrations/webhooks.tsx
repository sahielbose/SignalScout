'use client';

import { useState, useTransition } from 'react';
import { Webhook, Plus, Trash2, Send, Loader2, Copy, Check } from 'lucide-react';
import { createWebhookAction, deleteWebhookAction, testWebhookAction, toggleWebhookAction } from '@/lib/webhooks/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export interface WebhookView {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

function TestButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className="transition-all duration-200 active:scale-[0.97]"
      onClick={() =>
        start(async () => {
          const r = await testWebhookAction(id);
          toast(r.ok ? 'Test event delivered (HTTP 2xx)' : 'Delivery failed - check the URL', r.ok ? 'success' : 'error');
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Test
    </Button>
  );
}

function ActiveSwitch({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={active}
      disabled={pending}
      title={active ? 'Active - delivering events' : 'Paused'}
      onCheckedChange={(next) =>
        start(async () => {
          await toggleWebhookAction(id, next);
          toast(next ? 'Webhook activated' : 'Webhook paused', 'success');
        })
      }
    />
  );
}

export function Webhooks({ webhooks }: { webhooks: WebhookView[] }) {
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = (form: FormData) =>
    start(async () => {
      const r = await createWebhookAction(form);
      if (r.ok && r.secret) {
        setSecret(r.secret);
        setUrl('');
      } else toast(r.error ?? 'Could not create webhook', 'error');
    });

  const copy = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      <form action={create} className="flex gap-2">
        <Input
          name="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.com/webhooks/signal-scout"
        />
        <Button type="submit" disabled={pending} className="transition-all duration-200 hover:shadow-md active:scale-[0.98]">
          {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add
        </Button>
      </form>

      {secret && (
        <div className="animate-scale-in rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary">Copy this signing secret now - it won&apos;t be shown again.</p>
          <p className="mt-0.5 text-[0.7rem] text-muted-foreground">Use it to verify the <code>X-SignalScout-Signature</code> HMAC on every delivery.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">{secret}</code>
            <Button size="icon" variant="outline" onClick={copy} className="size-8 transition-all duration-200 hover:shadow-md active:scale-[0.96]">
              {copied ? <Check className="size-3.5 animate-pop text-primary" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y rounded-md border">
        {webhooks.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No webhooks. New high-strength matched signals POST a signed payload.</p>
        ) : (
          webhooks.map((w, i) => (
            <div key={w.id} className="flex animate-fade-up items-center gap-2 p-3 transition-colors hover:bg-muted/40" style={{ animationDelay: `${i * 50}ms` }}>
              <Webhook className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-xs">{w.url}</div>
                <div className="text-[0.7rem] text-muted-foreground">{w.events.join(', ')}</div>
              </div>
              <ActiveSwitch id={w.id} active={w.active} />
              <TestButton id={w.id} />
              <form action={deleteWebhookAction}>
                <input type="hidden" name="id" value={w.id} />
                <Button variant="ghost" size="icon" type="submit" title="Delete">
                  <Trash2 className="size-4" />
                </Button>
              </form>
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Verify with the <code>X-SignalScout-Signature</code> header (<code>t=&lt;ms&gt;,v1=&lt;hmac-sha256&gt;</code> over <code>{'`${t}.${body}`'}</code>).
      </p>
    </div>
  );
}
