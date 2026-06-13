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

function DeleteButton({ id, url }: { id: string; url: string }) {
  const [pending, start] = useTransition();
  const remove = () => {
    if (!confirm(`Delete this webhook? We will stop notifying ${url}.`)) return;
    start(async () => {
      const form = new FormData();
      form.set('id', id);
      await deleteWebhookAction(form);
      toast('Webhook deleted', 'success');
    });
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      disabled={pending}
      onClick={remove}
      aria-label="Delete webhook"
      title="Delete webhook"
      className="text-destructive transition-all duration-200 active:scale-[0.97]"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
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
          aria-label="Webhook URL to notify"
          placeholder="https://your-app.com/webhooks/signal-scout"
        />
        <Button type="submit" disabled={pending} className="shrink-0 transition-all duration-200 hover:shadow-md active:scale-[0.98]">
          {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add webhook
        </Button>
      </form>

      {secret && (
        <div className="animate-scale-in rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary">Copy this signing secret now. For your security we won&apos;t show it again.</p>
          <p className="mt-0.5 text-[0.7rem] text-muted-foreground">Your app uses it to confirm a notification really came from Signal Scout (it&apos;s in the <code>X-SignalScout-Signature</code> header on every delivery).</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">{secret}</code>
            <Button
              size="icon"
              variant="outline"
              onClick={copy}
              aria-label={copied ? 'Secret copied' : 'Copy signing secret'}
              title={copied ? 'Copied' : 'Copy signing secret'}
              className="size-8 shrink-0 transition-all duration-200 hover:shadow-md active:scale-[0.96]"
            >
              {copied ? <Check className="size-3.5 animate-pop text-primary" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y rounded-md border">
        {webhooks.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">No webhooks yet.</p>
            <p className="mt-0.5 text-xs">Paste your app&apos;s URL above and select Add webhook. From then on, we&apos;ll POST it a signed notification the moment a strong new buying signal lands.</p>
          </div>
        ) : (
          webhooks.map((w, i) => (
            <div key={w.id} className="flex animate-fade-up items-center gap-2 p-3 transition-colors hover:bg-muted/40" style={{ animationDelay: `${i * 50}ms` }}>
              <Webhook className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-xs">{w.url}</div>
                <div className="text-[0.7rem] text-muted-foreground">
                  {w.active ? 'On' : 'Paused'} · notifies on {w.events.join(', ')}
                </div>
              </div>
              <ActiveSwitch id={w.id} active={w.active} />
              <TestButton id={w.id} />
              <DeleteButton id={w.id} url={w.url} />
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Use the Test button to send your app a sample event and confirm it&apos;s wired up. To make sure each delivery
        really came from us, your app checks the <code>X-SignalScout-Signature</code> header
        (<code>t=&lt;ms&gt;,v1=&lt;hmac-sha256&gt;</code> over <code>{'`${t}.${body}`'}</code>) against your signing secret.
      </p>
    </div>
  );
}
