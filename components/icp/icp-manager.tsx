'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Crosshair, Sparkles, Loader2 } from 'lucide-react';
import type { IcpDefinition } from '@/lib/types';
import { SIGNAL_TYPE_LABELS } from '@/lib/types';
import { PRESET_ICPS } from '@/lib/sources/targets';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IcpForm } from './icp-form';
import {
  createIcpAction,
  updateIcpAction,
  deleteIcpAction,
  toggleIcpAction,
  createIcpFromPresetAction,
} from '@/lib/icp/actions';

export interface IcpView {
  id: string;
  name: string;
  active: boolean;
  definition: IcpDefinition;
}

export function IcpManager({ icps }: { icps: IcpView[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(icps.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [, startPreset] = useTransition();

  const usePreset = (name: string) =>
    startPreset(async () => {
      setPendingPreset(name);
      try {
        const r = await createIcpFromPresetAction(name);
        if (r.ok) {
          toast(`Preset added · ${name}`, 'success');
          router.refresh();
        } else {
          toast(r.error ?? 'Could not add preset', 'error');
        }
      } finally {
        setPendingPreset(null);
      }
    });

  const isFirstRun = icps.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <Card className="border-primary/20 bg-primary/[0.04] p-4">
        <p className="text-sm font-medium">How this works</p>
        <ol className="mt-1.5 space-y-1 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">1.</span> Describe the kind of customer you sell to (their
            industry, job titles, size, and so on).
          </li>
          <li>
            <span className="font-medium text-foreground">2.</span> Your live feed instantly shows only the public buying
            moments that fit, such as a fresh funding round or a new job posting.
          </li>
          <li>
            <span className="font-medium text-foreground">3.</span> We build a research profile with sources for the
            matching people, so you know who to reach out to and why.
          </li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          You can keep several profiles. Pick a ready-made one below to start fast, or build your own.
        </p>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Start from a ready-made profile (one click)
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {PRESET_ICPS.map((preset, i) => {
              const busy = pendingPreset === preset.name;
              return (
                <Card
                  key={preset.name}
                  className="flex animate-fade-up flex-col gap-2 p-3"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">{preset.name}</h3>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{preset.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-auto w-full text-xs"
                    disabled={busy}
                    onClick={() => usePreset(preset.name)}
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    {busy ? 'Adding…' : 'Use preset'}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
        {!creating && (
          <div className="flex sm:items-start">
            <Button onClick={() => setCreating(true)}>
              <Plus /> Build your own
            </Button>
          </div>
        )}
      </div>

      {creating && (
        <Card className="animate-scale-in p-5">
          <h2 className="text-sm font-semibold">
            {isFirstRun ? 'Set up your first customer profile' : 'Describe a new customer profile'}
          </h2>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            Fill in what you know. Anything you leave blank just means "no preference" and is not used as a filter.
          </p>
          <IcpForm
            action={async (fd) => {
              await createIcpAction(fd);
              setCreating(false);
            }}
            submitLabel="Save profile"
            onCancel={icps.length ? () => setCreating(false) : undefined}
          />
        </Card>
      )}

      {!creating && icps.length === 0 && (
        <Card className="flex animate-scale-in flex-col items-center gap-3 p-12 text-center">
          <Crosshair className="size-8 text-primary" />
          <p className="text-sm font-medium">No customer profiles yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add one so your feed can show the public buying moments that matter to you. Pick a ready-made profile above,
            or build your own.
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus /> Build a profile
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        {icps.map((icp, i) =>
          editingId === icp.id ? (
            <Card key={icp.id} className="animate-scale-in p-5">
              <h2 className="mb-4 text-sm font-semibold">Edit this customer profile</h2>
              <IcpForm
                action={async (fd) => {
                  await updateIcpAction(fd);
                  setEditingId(null);
                }}
                initial={icp}
                submitLabel="Save changes"
                onCancel={() => setEditingId(null)}
              />
            </Card>
          ) : (
            <Card
              key={icp.id}
              className="animate-fade-up p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium">{icp.name}</h3>
                    {!icp.active && (
                      <Badge variant="muted" title="Paused profiles do not filter your feed or trigger research">
                        Paused
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {icp.definition.signalTypes?.length ? (
                      icp.definition.signalTypes.map((t) => (
                        <Badge key={t} variant="secondary">
                          {SIGNAL_TYPE_LABELS[t]}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="muted">All buying moments</Badge>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                    {[
                      icp.definition.industries?.length ? `Industries: ${icp.definition.industries.join(', ')}` : '',
                      icp.definition.keywords?.length ? `Keywords: ${icp.definition.keywords.slice(0, 6).join(', ')}` : '',
                    ]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <form action={toggleIcpAction}>
                    <input type="hidden" name="id" value={icp.id} />
                    <input type="hidden" name="active" value={String(icp.active)} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      title={
                        icp.active
                          ? 'Pause: stop filtering the feed and building research for this profile'
                          : 'Turn back on: resume filtering the feed for this profile'
                      }
                    >
                      {icp.active ? 'Pause' : 'Turn on'}
                    </Button>
                  </form>
                  <Button variant="ghost" size="icon" onClick={() => setEditingId(icp.id)} title="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <form action={deleteIcpAction}>
                    <input type="hidden" name="id" value={icp.id} />
                    <Button
                      variant="ghost"
                      size="icon"
                      type="submit"
                      title="Delete this profile"
                      onClick={(e) => {
                        if (!window.confirm(`Delete "${icp.name}"? This removes it from your feed and cannot be undone.`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
