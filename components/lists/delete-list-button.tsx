'use client';

import { useState, useTransition } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Trash2, Loader2 } from 'lucide-react';
import { deleteListAction } from '@/lib/lists/actions';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';

/**
 * Delete a list behind a confirmation step. Deleting cascades every saved member
 * with no undo, so a bare one-click submit was too easy to trigger by mistake.
 */
export function DeleteListButton({ id, name, members }: { id: string; name: string; members: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await deleteListAction(fd);
      toast(`Deleted "${name}"`, 'success');
      setOpen(false);
    });

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" title="Delete list" aria-label={`Delete list ${name}`}>
          <Trash2 className="size-4" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 animate-scale-in rounded-lg border bg-popover p-5 text-popover-foreground shadow-lg">
          <Dialog.Title className="text-sm font-semibold">Delete &quot;{name}&quot;?</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            This permanently removes the list and its {members} saved {members === 1 ? 'entry' : 'entries'}. It cannot be
            undone.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button variant="destructive" size="sm" onClick={confirm} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete list
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
