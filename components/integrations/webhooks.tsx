'use client';

import { useState, useTransition } from 'react';
import { Webhook, Plus, Trash2, Send, Loader2, Copy, Check, SlidersHorizontal } from 'lucide-react';
import {
  createWebhookAction,
  deleteWebhookAction,
  testWebhookAction,
  toggleWebhookAction,
  updateWebhookEventsAction,
  updateWebhookFiltersAction,
} from '@/lib/webhooks/actions';
import { TAXONOMY, type TaxonomyEntry } from '@/lib/classify/taxonomy';
import { SIGNAL_TYPES } from '@/lib/types';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export interface WebhookFiltersView {
  minStrength?: number;
  signalTypes?: string[];
  icpIds?: string[];
}

export interface WebhookView {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  filters: WebhookFiltersView;
}

export interface IcpOption {
  id: string;
  name: string;
  active: boolean;
}

/** Plain-language label for each signal kind (a public buying moment). */
const TYPE_LABEL = (t: string): string => (TAXONOMY as Record<string, TaxonomyEntry>)[t]?.label ?? t;

/** The events a webhook can subscribe to, in plain words. */
const EVENT_OPTIONS: { value: string; label: string; help: string }[] = [
  {
    value: 'signal.created',
    label: 'New buying signal',
    help: 'We POST your app the moment a new public buying moment lands for your kind of customer.',
  },
];

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
      aria-label={active ? 'Pause webhook' : 'Activate webhook'}
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

/** Plain-language one-line summary of a webhook's filters, shown when collapsed. */
function summarize(w: WebhookView): string {
  const parts: string[] = [];
  if (typeof w.filters.minStrength === 'number') {
    parts.push(`strength ${Math.round(w.filters.minStrength * 100)}%+`);
  }
  if (w.filters.signalTypes?.length) {
    parts.push(`${w.filters.signalTypes.length} signal type${w.filters.signalTypes.length === 1 ? '' : 's'}`);
  }
  if (w.filters.icpIds?.length) {
    parts.push(`${w.filters.icpIds.length} customer type${w.filters.icpIds.length === 1 ? '' : 's'}`);
  }
  return parts.length ? `Only when ${parts.join(', ')}` : 'Fires on every matching signal';
}

function CustomizePanel({ webhook, icps }: { webhook: WebhookView; icps: IcpOption[] }) {
  const [pending, start] = useTransition();

  // Local, editable copies of this webhook's settings.
  const [useMin, setUseMin] = useState(typeof webhook.filters.minStrength === 'number');
  const [minStrength, setMinStrength] = useState(
    typeof webhook.filters.minStrength === 'number' ? webhook.filters.minStrength : 0.7,
  );
  const [types, setTypes] = useState<string[]>(webhook.filters.signalTypes ?? []);
  const [icpIds, setIcpIds] = useState<string[]>(webhook.filters.icpIds ?? []);
  const [events, setEvents] = useState<string[]>(webhook.events);

  const toggleIn = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const saveFilters = () =>
    start(async () => {
      const r = await updateWebhookFiltersAction(webhook.id, {
        minStrength: useMin ? minStrength : undefined,
        signalTypes: types.length ? types : undefined,
        icpIds: icpIds.length ? icpIds : undefined,
      });
      toast(r.ok ? 'Delivery rules saved' : r.error ?? 'Could not save', r.ok ? 'success' : 'error');
    });

  const saveEvents = (next: string[]) =>
    start(async () => {
      setEvents(next);
      const r = await updateWebhookEventsAction(webhook.id, next);
      if (!r.ok) {
        setEvents(webhook.events);
        toast(r.error ?? 'Could not update events', 'error');
      } else {
        toast('Events updated', 'success');
      }
    });

  return (
    <div className="space-y-4 border-t bg-muted/20 p-3">
      {/* What this webhook listens for */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-foreground">What this webhook listens for</legend>
        {EVENT_OPTIONS.map((ev) => {
          const on = events.includes(ev.value);
          return (
            <label key={ev.value} className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={on}
                disabled={pending}
                onChange={() => saveEvents(toggleIn(events, ev.value))}
                className="mt-0.5 size-3.5 accent-primary"
                aria-label={ev.label}
              />
              <span>
                <span className="font-medium text-foreground">{ev.label}</span>
                <span className="block text-muted-foreground">{ev.help}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {/* Minimum strength */}
      <fieldset className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-xs font-semibold text-foreground">
            Only fire above a minimum strength
          </legend>
          <Switch
            checked={useMin}
            disabled={pending}
            onCheckedChange={setUseMin}
            aria-label="Use a minimum strength"
          />
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          Strength is how strong a buying sign it is, from 0 to 100%. Turn this on to skip weaker moments.
        </p>
        {useMin && (
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(minStrength * 100)}
              disabled={pending}
              onChange={(e) => setMinStrength(Number(e.target.value) / 100)}
              className="h-1.5 flex-1 cursor-pointer accent-primary"
              aria-label="Minimum strength percent"
            />
            <span className="w-12 text-right font-mono text-xs tabular-nums">
              {Math.round(minStrength * 100)}%
            </span>
          </div>
        )}
      </fieldset>

      {/* Signal types */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-foreground">Which signal types fire it</legend>
        <p className="text-[0.7rem] text-muted-foreground">
          A signal type is the kind of public buying moment. Pick some to fire only on those, or leave all
          unchecked to fire on any kind.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SIGNAL_TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                disabled={pending}
                onClick={() => setTypes((prev) => toggleIn(prev, t))}
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 text-[0.7rem] transition-colors ${
                  on
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input text-muted-foreground hover:bg-muted'
                }`}
              >
                {TYPE_LABEL(t)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ICPs */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-foreground">Which kinds of customer (optional)</legend>
        <p className="text-[0.7rem] text-muted-foreground">
          An ICP is the kind of customer you sell to. Pick some to fire only for those, or leave all unchecked
          for any of yours.
        </p>
        {icps.length === 0 ? (
          <p className="text-[0.7rem] text-muted-foreground">
            You have no customer profiles yet. Add one and it will show up here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {icps.map((icp) => {
              const on = icpIds.includes(icp.id);
              return (
                <button
                  key={icp.id}
                  type="button"
                  disabled={pending}
                  onClick={() => setIcpIds((prev) => toggleIn(prev, icp.id))}
                  aria-pressed={on}
                  title={icp.active ? icp.name : `${icp.name} (paused)`}
                  className={`max-w-[16rem] truncate rounded-full border px-2.5 py-1 text-[0.7rem] transition-colors ${
                    on
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {icp.name}
                  {!icp.active && ' (paused)'}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={saveFilters}
          disabled={pending}
          className="transition-all duration-200 active:scale-[0.98]"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save delivery rules
        </Button>
        <span className="text-[0.7rem] text-muted-foreground">Applies to future signals.</span>
      </div>
    </div>
  );
}

function WebhookRow({ webhook, icps, index }: { webhook: WebhookView; icps: IcpOption[]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex items-center gap-2 p-3 transition-colors hover:bg-muted/40">
        <Webhook className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs">{webhook.url}</div>
          <div className="text-[0.7rem] text-muted-foreground">
            {webhook.active ? 'On' : 'Paused'} · {summarize(webhook)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Customize this webhook"
          className="transition-all duration-200 active:scale-[0.97]"
        >
          <SlidersHorizontal className="size-3.5" /> Customize
        </Button>
        <ActiveSwitch id={webhook.id} active={webhook.active} />
        <TestButton id={webhook.id} />
        <DeleteButton id={webhook.id} url={webhook.url} />
      </div>
      {open && <CustomizePanel webhook={webhook} icps={icps} />}
    </div>
  );
}

export function Webhooks({ webhooks, icps }: { webhooks: WebhookView[]; icps: IcpOption[] }) {
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
            <p className="mt-0.5 text-xs">Paste your app&apos;s URL above and select Add webhook. From then on, we&apos;ll POST it a signed notification the moment a strong new buying signal lands. Use Customize to fine-tune exactly which signals fire it.</p>
          </div>
        ) : (
          webhooks.map((w, i) => <WebhookRow key={w.id} webhook={w} icps={icps} index={i} />)
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
