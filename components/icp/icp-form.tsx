'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import {
  SIGNAL_TYPES,
  SIGNAL_TYPE_LABELS,
  COMPANY_SIZE_RANGES,
  type CompanySizeRange,
  type IcpDefinition,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const SIZE_LABELS: Record<CompanySizeRange, string> = {
  '1-10': '1 to 10',
  '11-50': '11 to 50',
  '51-200': '51 to 200',
  '201-1000': '201 to 1,000',
  '1000+': '1,000+',
};

/** Pull the known ranges back out of a stored companySize string (any order/format). */
function parseSelectedSizes(companySize?: string): CompanySizeRange[] {
  if (!companySize) return [];
  const parts = companySize.split(',').map((p) => p.trim());
  return COMPANY_SIZE_RANGES.filter((r) => parts.includes(r));
}

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
  const [sizes, setSizes] = useState<CompanySizeRange[]>(parseSelectedSizes(d?.companySize));
  const toggleSize = (r: CompanySizeRange) =>
    setSizes((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  // Submit the picked ranges as the comma-joined string the action already reads.
  const companySizeValue = COMPANY_SIZE_RANGES.filter((r) => sizes.includes(r)).join(', ');
  return (
    <form action={action} className="space-y-4">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
        <Field label="Profile name" htmlFor="name" hint="just for you">
          <Input id="name" name="name" required defaultValue={initial?.name ?? ''} placeholder="e.g. Fintech startups hiring sales" />
        </Field>
      </div>

      <div className="grid animate-fade-up gap-4 sm:grid-cols-2" style={{ animationDelay: '50ms' }}>
        <Field label="Industries" hint="separate with commas">
          <Textarea name="industries" defaultValue={d?.industries?.join(', ') ?? ''} placeholder="fintech, developer tools, payments" />
        </Field>
        <Field label="Job titles you sell to" hint="separate with commas">
          <Textarea name="titles" defaultValue={d?.titles?.join(', ') ?? ''} placeholder="account executive, head of sales, gtm" />
        </Field>
        <Field label="Good-fit keywords" hint="words that describe a good fit">
          <Textarea name="keywords" defaultValue={d?.keywords?.join(', ') ?? ''} placeholder="api, payments, infrastructure, sdk" />
        </Field>
        <Field label="Locations" hint="countries or regions, comma-separated">
          <Textarea name="geos" defaultValue={d?.geos?.join(', ') ?? ''} placeholder="United States, EMEA, Remote" />
        </Field>
        <Field label="Exclude these words" hint="words that rule a company OUT">
          <Textarea
            name="excludeKeywords"
            defaultValue={d?.excludeKeywords?.join(', ') ?? ''}
            placeholder="recruiting, staffing, job board, crypto"
          />
        </Field>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        Exclude words are a hard filter. If a public buying moment mentions any of them, we drop it from this profile even
        when the good-fit words match. Use it to keep look-alikes out, like staffing firms when you sell to product teams.
      </p>

      <div className="grid animate-fade-up gap-4 sm:grid-cols-2" style={{ animationDelay: '100ms' }}>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label>Company size</Label>
            <span className="text-[0.7rem] text-muted-foreground">number of employees · pick any</span>
          </div>
          {/* Toggle buttons, joined into the comma string the action already reads. */}
          <input type="hidden" name="companySize" value={companySizeValue} />
          <div className="flex flex-wrap gap-1.5">
            {COMPANY_SIZE_RANGES.map((r) => {
              const on = sizes.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSize(r)}
                  className={
                    'cursor-pointer select-none rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96] ' +
                    (on
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'text-muted-foreground')
                  }
                >
                  {SIZE_LABELS[r]}
                </button>
              );
            })}
          </div>
          <p className="text-[0.7rem] text-muted-foreground">Leave all unpicked to allow any size.</p>
        </div>
        <Field label="When to alert me" htmlFor="notifyThreshold" hint="0 = everything, 1 = only the strongest">
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
      <p className="-mt-1 text-xs text-muted-foreground">
        Strength is how strong a buying sign is, from 0 to 1. We only send an alert when a match is at least this strong.
        0.7 is a good starting point.
      </p>

      <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
        <Label>Which buying moments count</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          A buying moment is a public sign a company may be ready to buy, like a funding round or a new job posting. Pick
          the ones you care about, or leave all unselected to include every kind.
        </p>
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

      <div className="animate-fade-up rounded-md border bg-muted/30 p-3" style={{ animationDelay: '200ms' }}>
        <p className="mb-2 text-xs font-medium">How should we tell you about strong matches?</p>
        <div className="flex flex-wrap items-center gap-6">
          <ToggleField name="notifyEmail" label="Email me" defaultChecked={d?.notify?.email ?? false} />
          <ToggleField name="notifySlack" label="Send to Slack" defaultChecked={d?.notify?.slack ?? false} />
        </div>
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
