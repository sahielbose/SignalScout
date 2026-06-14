'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Building2,
  Calendar,
  Compass,
  FileSearch,
  Gauge,
  ListChecks,
  Plug,
  Radio,
  Search,
  Settings as SettingsIcon,
  Target,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchKind = 'person' | 'company' | 'signal' | 'page';

interface SearchResult {
  kind: SearchKind;
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
  icon?: typeof User;
}

interface GlobalSearchResults {
  people: SearchResult[];
  companies: SearchResult[];
  signals: SearchResult[];
}

const EMPTY: GlobalSearchResults = { people: [], companies: [], signals: [] };

/**
 * The static launcher index: every page and feature, with rich keywords so a
 * search like "ai key", "slack", "webhook", "accuracy" or "cost" jumps straight
 * to the right page. This is matched instantly client-side, so the palette is
 * useful the moment it opens, with no waiting and no clicking through pages.
 */
interface NavItem {
  label: string;
  sublabel: string;
  href: string;
  icon: typeof User;
  keywords: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Feed', sublabel: 'Your live list of public buying signals', href: '/feed', icon: Radio, keywords: ['feed', 'signals', 'home', 'inbox', 'worklist', 'buying'] },
  { label: 'Customer types (ICPs)', sublabel: 'Define the kind of customer you sell to', href: '/icps', icon: Target, keywords: ['icp', 'icps', 'customer', 'audience', 'target', 'ideal customer', 'who you sell to', 'persona'] },
  { label: 'Research', sublabel: 'Build a sourced research profile on a person or company', href: '/research', icon: FileSearch, keywords: ['research', 'dossier', 'profile', 'deep research', 'person', 'enrich'] },
  { label: 'Companies', sublabel: 'Companies showing buying signals', href: '/companies', icon: Building2, keywords: ['companies', 'accounts', 'org', 'organizations'] },
  { label: 'Lists', sublabel: 'Saved groups of people and companies', href: '/lists', icon: ListChecks, keywords: ['lists', 'saved', 'export', 'csv', 'crm', 'group'] },
  { label: 'Events', sublabel: 'Public events your prospects attend', href: '/events', icon: Calendar, keywords: ['events', 'conferences', 'meetups', 'luma', 'summit'] },
  { label: 'Integrations', sublabel: 'Connect webhooks, Slack, CRM, MCP, and API keys', href: '/integrations', icon: Plug, keywords: ['integrations', 'webhook', 'webhooks', 'slack', 'crm', 'mcp', 'api key', 'connect', 'hubspot', 'salesforce'] },
  { label: 'Usage and your AI key', sublabel: 'Daily allowance, cost, and bring your own AI key', href: '/usage', icon: Gauge, keywords: ['usage', 'quota', 'limits', 'cost', 'billing', 'byo', 'ai key', 'anthropic key', 'allowance'] },
  { label: 'Metrics', sublabel: 'AI accuracy and how much it has cost over time', href: '/evals', icon: BarChart3, keywords: ['metrics', 'cost', 'charts', 'analytics', 'spend', 'accuracy', 'evals', 'precision', 'recall', 'f1', 'quality'] },
  { label: 'Profile', sublabel: 'You, your workspace, and your activity', href: '/profile', icon: User, keywords: ['profile', 'me', 'you', 'account', 'my'] },
  { label: 'Settings', sublabel: 'Workspace, team, and view preferences', href: '/settings', icon: SettingsIcon, keywords: ['settings', 'workspace', 'team', 'preferences', 'rename', 'name', 'members', 'role'] },
];

function matchNav(term: string): SearchResult[] {
  const t = term.trim().toLowerCase();
  const items = !t
    ? NAV_ITEMS
    : NAV_ITEMS.filter(
        (n) =>
          n.label.toLowerCase().includes(t) ||
          n.sublabel.toLowerCase().includes(t) ||
          n.keywords.some((k) => k.includes(t)),
      );
  return items.map((n) => ({ kind: 'page' as const, id: n.href, label: n.label, sublabel: n.sublabel, href: n.href, icon: n.icon }));
}

const GROUPS: { key: 'pages' | keyof GlobalSearchResults; title: string; icon: typeof User }[] = [
  { key: 'pages', title: 'Go to', icon: Compass },
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

  // Pages match instantly client-side; entity results stream in from the server.
  const pages = React.useMemo(() => matchNav(query), [query]);
  const grouped = React.useMemo(
    () => ({ pages, people: results.people, companies: results.companies, signals: results.signals }),
    [pages, results],
  );

  // Flat, ordered list mirroring the rendered groups (drives keyboard nav).
  const flat = React.useMemo<SearchResult[]>(() => GROUPS.flatMap((g) => grouped[g.key]), [grouped]);

  // Cmd/Ctrl+K toggles the palette from anywhere. A custom event lets the
  // sidebar/topbar Search buttons open it too.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('ss:open-search', onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('ss:open-search', onOpen);
    };
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

  // Debounced fetch against /api/search for people/companies/signals.
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
            Jump to any page, person, company, or signal in your workspace.
          </Dialog.Description>

          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages, people, companies, signals..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search"
            />
            <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground sm:inline-block">
              Esc
            </kbd>
          </div>

          <div className="scroll-thin max-h-[min(60vh,28rem)] overflow-y-auto p-2">
            {!term && (
              <p className="px-3 pb-1 pt-2 text-[0.7rem] font-medium text-muted-foreground">
                Jump to a page, or start typing to find a person, company, or signal.
              </p>
            )}

            {term && !hasResults && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {loading ? 'Searching...' : `No results for "${term}".`}
              </p>
            )}

            {hasResults &&
              GROUPS.map((group) => {
                const items = grouped[group.key];
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
                        const ItemIcon = item.icon ?? GroupIcon;
                        return (
                          <li key={`${item.kind}-${item.id}`} role="option" aria-selected={active}>
                            <button
                              type="button"
                              onClick={() => navigate(item.href)}
                              onMouseEnter={() => setActiveIndex(index)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
                                active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/60',
                              )}
                            >
                              <ItemIcon className="size-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{item.label}</span>
                                {item.sublabel && (
                                  <span className="block truncate text-xs text-muted-foreground">{item.sublabel}</span>
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

          <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[0.7rem] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-medium">&#8593;</kbd>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-medium">&#8595;</kbd>
              to move
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-medium">&#8629;</kbd>
              to open
            </span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-medium">Esc</kbd>
              to close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
