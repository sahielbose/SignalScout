'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Crosshair } from 'lucide-react';
import type { IcpDefinition } from '@/lib/types';
import { SIGNAL_TYPE_LABELS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IcpForm } from './icp-form';
import { createIcpAction, updateIcpAction, deleteIcpAction, toggleIcpAction } from '@/lib/icp/actions';

export interface IcpView {
  id: string;
  name: string;
  active: boolean;
  definition: IcpDefinition;
}

export function IcpManager({ icps }: { icps: IcpView[] }) {
  const [creating, setCreating] = useState(icps.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div className="flex justify-end">
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus /> New ICP
          </Button>
        )}
      </div>

      {creating && (
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Define an ideal customer profile</h2>
          <IcpForm
            action={async (fd) => {
              await createIcpAction(fd);
              setCreating(false);
            }}
            submitLabel="Create ICP"
            onCancel={icps.length ? () => setCreating(false) : undefined}
          />
        </Card>
      )}

      {icps.length === 0 && !creating && (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Crosshair className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">No ICPs yet. Define who you sell to so the feed can filter to them.</p>
          <Button onClick={() => setCreating(true)}>
            <Plus /> Define your first ICP
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        {icps.map((icp) =>
          editingId === icp.id ? (
            <Card key={icp.id} className="p-5">
              <h2 className="mb-4 text-sm font-semibold">Edit ICP</h2>
              <IcpForm
                action={async (fd) => {
                  await updateIcpAction(fd);
                  setEditingId(null);
                }}
                initial={icp}
                onCancel={() => setEditingId(null)}
              />
            </Card>
          ) : (
            <Card key={icp.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium">{icp.name}</h3>
                    {!icp.active && <Badge variant="muted">paused</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {icp.definition.signalTypes?.map((t) => (
                      <Badge key={t} variant="secondary">
                        {SIGNAL_TYPE_LABELS[t]}
                      </Badge>
                    ))}
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
                      title={icp.active ? 'Pause this ICP' : 'Activate this ICP'}
                    >
                      {icp.active ? 'Pause' : 'Activate'}
                    </Button>
                  </form>
                  <Button variant="ghost" size="icon" onClick={() => setEditingId(icp.id)} title="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <form action={deleteIcpAction}>
                    <input type="hidden" name="id" value={icp.id} />
                    <Button variant="ghost" size="icon" type="submit" title="Delete">
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
