'use client';

import { useState, useTransition } from 'react';
import { Webhook, Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { createWebhookAction, deleteWebhookAction, testWebhookAction } from '@/lib/webhooks/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

export function Webhooks({ webhooks }: { webhooks: WebhookView[] }) {
  const [url, setUrl] = useState('');
  return (
    <div className="space-y-3">
      <form action={createWebhookAction} className="flex gap-2" onSubmit={() => setUrl('')}>
        <Input name="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/signal-scout" />
        <Button type="submit" className="transition-all duration-200 hover:shadow-md active:scale-[0.98]">
          <Plus /> Add
        </Button>
      </form>

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
