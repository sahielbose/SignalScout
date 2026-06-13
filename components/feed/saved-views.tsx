'use client';

import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Bookmark, Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { SavedView } from '@/lib/views/service';
import { saveViewAction, deleteViewAction } from '@/lib/views/actions';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** The query keys that make up a saved view (filters + sort, not the cleared toggle). */
const VIEW_KEYS = ['icpId', 'type', 'source', 'minStrength', 'sinceDays', 'q', 'sort'] as const;

/**
 * Saved views: name the current filter + sort setup, re-apply it later, or
 * delete it. Views are shared across everyone in the workspace.
 */
export function SavedViews({ views }: { views: SavedView[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // The current filter + sort state, as a plain object to store with the view.
  const currentParams = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const k of VIEW_KEYS) {
      const v = params.get(k);
      if (v) out[k] = v;
    }
    return out;
  }, [params]);

  const hasActiveFilters = VIEW_KEYS.some((k) => params.get(k));

  const applyView = useCallback(
    (view: SavedView) => {
      const next = new URLSearchParams();
      for (const k of VIEW_KEYS) {
        const v = view.params[k];
        if (v) next.set(k, v);
      }
      // Keep the user's current cleared-vs-open toggle when applying a view.
      if (params.get('showCleared') === '1') next.set('showCleared', '1');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      setOpen(false);
    },
    [params, pathname, router],
  );

  const save = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast('Give the view a name', 'error');
      inputRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const r = await saveViewAction('feed', trimmed, currentParams());
      if (r.ok) {
        toast(`Saved view "${trimmed}"`, 'success');
        setName('');
        setNaming(false);
        setOpen(false);
        router.refresh();
      } else {
        toast(r.error ?? 'Could not save view', 'error');
      }
    });
  }, [name, currentParams, router]);

  const remove = useCallback(
    (view: SavedView) => {
      startTransition(async () => {
        const r = await deleteViewAction('feed', view.id);
        if (r.ok) {
          toast(`Deleted view "${view.name}"`, 'success');
          router.refresh();
        } else {
          toast('Could not delete view', 'error');
        }
      });
    },
    [router],
  );

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <Bookmark className="size-3.5" />
        Saved views
        {views.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
            {views.length}
          </span>
        )}
        <ChevronDown className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-20" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1.5 w-72 animate-fade-down rounded-md border border-border bg-popover p-1.5 shadow-lg"
          >
            <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
              A saved view remembers your filters and sort order.
            </p>

            {views.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">No saved views yet.</p>
            ) : (
              <ul className="max-h-56 overflow-y-auto py-1">
                {views.map((view) => (
                  <li key={view.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => applyView(view)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs text-foreground transition-colors duration-150 hover:bg-muted"
                    >
                      <Check className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{view.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete view ${view.name}`}
                      disabled={pending}
                      onClick={() => remove(view)}
                      className="shrink-0 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-1 border-t border-border pt-1.5">
              {naming ? (
                <div className="flex items-center gap-1.5 px-1">
                  <input
                    ref={inputRef}
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') save();
                      if (e.key === 'Escape') setNaming(false);
                    }}
                    maxLength={60}
                    placeholder="Name this view"
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button size="sm" onClick={save} disabled={pending}>
                    Save
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setNaming(true)}
                  disabled={!hasActiveFilters}
                  title={
                    hasActiveFilters
                      ? 'Save the current filters and sort as a named view'
                      : 'Pick at least one filter or sort first'
                  }
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  Save current view
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
