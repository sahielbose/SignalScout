'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { SIGNAL_TYPES, SIGNAL_TYPE_LABELS, type IcpDefinition } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}

export interface IcpFormProps {
  action: (form: FormData) => void | Promise<void>;
  initial?: { id?: string; name: string; definition: IcpDefinition };
  submitLabel?: string;
  onCancel?: () => void;
}

export function IcpForm({ action, initial, submitLabel = 'Save ICP', onCancel }: IcpFormProps) {
  const d = initial?.definition;
  return (
    <form action={action} className="space-y-4">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" required defaultValue={initial?.name ?? ''} placeholder="e.g. Series A fintech raising + hiring GTM" />
        </Field>
      </div>

      <div className="grid animate-fade-up gap-4 sm:grid-cols-2" style={{ animationDelay: '50ms' }}>
        <Field label="Industries" hint="comma-separated">
          <Textarea name="industries" defaultValue={d?.industries?.join(', ') ?? ''} placeholder="fintech, developer tools, payments" />
        </Field>
        <Field label="Target titles" hint="comma-separated">
          <Textarea name="titles" defaultValue={d?.titles?.join(', ') ?? ''} placeholder="account executive, head of sales, gtm" />
        </Field>
        <Field label="Keywords" hint="comma-separated">
          <Textarea name="keywords" defaultValue={d?.keywords?.join(', ') ?? ''} placeholder="api, payments, infrastructure, sdk" />
        </Field>
        <Field label="Geographies" hint="comma-separated">
          <Textarea name="geos" defaultValue={d?.geos?.join(', ') ?? ''} placeholder="United States, EMEA, Remote" />
        </Field>
      </div>

      <div className="grid animate-fade-up gap-4 sm:grid-cols-2" style={{ animationDelay: '100ms' }}>
        <Field label="Company size" htmlFor="companySize">
          <Input id="companySize" name="companySize" defaultValue={d?.companySize ?? ''} placeholder="11-200" />
        </Field>
        <Field label="Notify strength threshold" htmlFor="notifyThreshold" hint="0-1; notify above this">
          <Input
            id="notifyThreshold"
            name="notifyThreshold"
            type="number"
            step="0.05"
            min="0"
            max="1"
            defaultValue={d?.notifyThreshold ?? 0.7}
          />
        </Field>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
        <Label>Signal types that matter</Label>
        <p className="mb-2 text-xs text-muted-foreground">A hard filter - only these types match this ICP.</p>
        <div className="flex flex-wrap gap-1.5">
          {SIGNAL_TYPES.map((t) => {
            const checked = d?.signalTypes?.includes(t) ?? false;
            return (
              <label
                key={t}
                className="cursor-pointer select-none rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96] has-[:checked]:animate-pop has-[:checked]:border-primary/40 has-[:checked]:bg-primary/15 has-[:checked]:text-primary"
              >
                <input type="checkbox" name="signalTypes" value={t} defaultChecked={checked} className="sr-only" />
                {SIGNAL_TYPE_LABELS[t]}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-md border bg-muted/30 p-3 animate-fade-up" style={{ animationDelay: '200ms' }}>
        <ToggleField name="notifyEmail" label="Email alerts" defaultChecked={d?.notify?.email ?? false} />
        <ToggleField name="notifySlack" label="Slack alerts" defaultChecked={d?.notify?.slack ?? false} />
      </div>

      <div className="flex items-center gap-2 animate-fade-up" style={{ animationDelay: '250ms' }}>
        <SubmitButton label={submitLabel} />
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <span className="text-[0.7rem] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ToggleField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Switch name={name} defaultChecked={defaultChecked} />
      <Label className="text-sm font-normal">{label}</Label>
    </div>
  );
}
