'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Check, Loader2, Trash2 } from 'lucide-react';
import { saveByoKeyAction, clearByoKeyAction } from '@/lib/users/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ByoKey({ masked }: { masked: string | null }) {
  const [key, setKey] = useState('');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(!!masked);

  const save = () =>
    start(async () => {
      const r = await saveByoKeyAction(key);
      if (r.ok) {
        toast('API key saved — your research now runs on your key', 'success');
        setSaved(true);
        setKey('');
      } else toast(r.error ?? 'Could not save key', 'error');
    });

  const clear = () =>
    start(async () => {
      await clearByoKeyAction();
      setSaved(false);
      toast('API key removed', 'default');
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <KeyRound className="size-4 text-muted-foreground" />
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-primary">
            <Check className="size-4" /> Using your own key {masked ? <code className="text-xs text-muted-foreground">{masked}</code> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">No personal key — using the shared free tier.</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-…  (Anthropic key)"
          autoComplete="off"
        />
        <Button onClick={save} disabled={pending || !key}>
          {pending ? <Loader2 className="animate-spin" /> : null} Save
        </Button>
        {saved && (
          <Button variant="ghost" size="icon" onClick={clear} disabled={pending} title="Remove key">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Stored against your account and used only for your dossiers — it bypasses the shared daily quota. Never sent to the browser.
      </p>
    </div>
  );
}
