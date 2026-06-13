'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { Building2, Radio, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchKind = 'person' | 'company' | 'signal';

interface SearchResult {
  kind: SearchKind;
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
}

interface GlobalSearchResults {
  people: SearchResult[];
  companies: SearchResult[];
  signals: SearchResult[];
}

const EMPTY: GlobalSearchResults = { people: [], companies: [], signals: [] };

const GROUPS: { key: keyof GlobalSearchResults; title: string; icon: typeof User }[] = [
  { key: 'people', title: 'People', icon: User },
  { key: 'companies', title: 'Companies', icon: Building2 },
  { key: 'signals', title: 'Signals', icon: Radio },
];

export function CommandK() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<GlobalSearchResults>(EMPTY);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  // Flat, ordered list mirroring the rendered groups (drives keyboard nav).
  const flat = React.useMemo<SearchResult[]>(
    () => GROUPS.flatMap((g) => results[g.key]),
    [results],
  );

  // ── Cmd/Ctrl+K toggles the palette from anywhere ──────────────────────
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Reset transient state whenever the dialog opens or closes.
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(EMPTY);
      setActiveIndex(0);
      setLoading(false);
    }
  }, [open]);

  // ── Debounced fetch against /api/search ───────────────────────────────
  React.useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : EMPTY))
        .then((data: GlobalSearchResults) => {
          setResults({
            people: data.people ?? [],
            companies: data.companies ?? [],
            signals: data.signals ?? [],
          });
          setActiveIndex(0);
        })
        .catch(() => {
          /* aborted or network error - leave prior results */
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  // Keep the active index in range as results change.
  React.useEffect(() => {
    setActiveIndex((i) => (flat.length === 0 ? 0 : Math.min(i, flat.length - 1)));
  }, [flat.length]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) navigate(item.href);
    }
  }

  const hasResults = flat.length > 0;
  const term = query.trim();

  // Running offset so each group's items map back to flat-list indices.
  let cursor = 0;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            // Keep focus on the input, not the first result.
            e.preventDefault();
          }}
          className="fixed left-1/2 top-[15%] z-50 w-[min(calc(100vw-2rem),36rem)] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl data-[state=open]:animate-fade-in"
        >
          <Dialog.Title className="sr-only">Search Signal Scout</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search people, companies, and signals in your workspace.
          </Dialog.Description>

          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search people, companies, signals..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search"
            />
            <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground sm:inline-block">
              Esc
            </kbd>
          </div>

          <div className="scroll-thin max-h-[min(60vh,28rem)] overflow-y-auto p-2">
            {!term && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Type to search your workspace.
              </p>
            )}

            {term && !hasResults && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {loading ? 'Searching...' : `No results for "${term}".`}
              </p>
            )}

            {term &&
              hasResults &&
              GROUPS.map((group) => {
                const items = results[group.key];
                if (items.length === 0) return null;
                const GroupIcon = group.icon;
                return (
                  <div key={group.key} className="mb-1 last:mb-0">
                    <div className="px-2 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.title}
                    </div>
                    <ul role="listbox" aria-label={group.title}>
                      {items.map((item) => {
                        const index = cursor++;
                        const active = index === activeIndex;
                        return (
                          <li key={`${item.kind}-${item.id}`} role="option" aria-selected={active}>
                            <button
                              type="button"
                              onClick={() => navigate(item.href)}
                              onMouseEnter={() => setActiveIndex(index)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
                                active
                                  ? 'bg-accent text-accent-foreground'
                                  : 'text-foreground hover:bg-accent/60',
                              )}
                            >
                              <GroupIcon className="size-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{item.label}</span>
                                {item.sublabel && (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {item.sublabel}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
