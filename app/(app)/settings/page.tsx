'use client';

import { useEffect, useState, useTransition } from 'react';
import { ArrowDownWideNarrow, Keyboard, LayoutList, Rows3, Search } from 'lucide-react';
import { toast } from '@/lib/toast';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { usePref } from '@/lib/hooks/use-pref';
import { cn } from '@/lib/utils';
import { getSettingsData, updateOrgName, updateProfileName, type SettingsData } from './actions';

export const dynamic = 'force-dynamic';

// ── View-preference types and the exact usePref keys other pages read ────────
//
// These keys are intentionally the SAME ones the list surfaces already read, so
// a default chosen here genuinely changes those pages the next time they load:
//
//   feed-density      -> components/feed/filter-bar.tsx + feed-list.tsx
//   events-density    -> components/events/events-view.tsx
//   companies:density -> components/companies/org-tree.tsx
//   feedSort          -> the default ordering applied by the "Open feed" link below
//   showCmdKHint      -> whether the keyboard-shortcut hint is shown (mirrored here)
//
type Density = 'comfortable' | 'compact';
type FeedSort = 'newest' | 'strongest' | 'oldest';

const FEED_SORT_OPTIONS: { value: FeedSort; label: string; hint: string }[] = [
  { value: 'newest', label: 'Newest first', hint: 'most recent buying moments at the top' },
  { value: 'strongest', label: 'Strongest buying sign first', hint: 'how strong a buying sign it is, highest first' },
  { value: 'oldest', label: 'Oldest first', hint: 'earliest buying moments at the top' },
];

const selectCls =
  'h-9 cursor-pointer rounded-md border border-input bg-background px-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);

  useEffect(() => {
    let active = true;
    getSettingsData()
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        /* requireUser redirects on the server when unauthenticated */
      });
    return () => {
      active = false;
    };
  }, []);

  // Re-fetch after a save so the cards show the new value without a reload (this
  // is a client component, so revalidatePath alone cannot re-run the effect above).
  const reload = () => {
    getSettingsData()
      .then(setData)
      .catch(() => {});
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your workspace name, see who is on your team, update your own name, and choose how lists and the feed look for you. A workspace is the shared account everyone on your team works inside."
        helper="Type a new name in a box, then press Save. Only a workspace owner or admin can rename the whole workspace; you can always change your own name. View preferences below are saved in this browser only."
      />
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        {data ? (
          <>
            <WorkspaceCard data={data} onSaved={reload} />
            <MembersCard data={data} />
            <ProfileCard data={data} onSaved={reload} />
          </>
        ) : (
          <LoadingCards />
        )}

        {/* Preferences are purely client-side, so they render immediately and do
            not need to wait on the workspace data above. */}
        <PreferencesCard />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace card: the shared account that owns your customer types, feed, and
// research. Renaming is gated to owners and admins, matching actions.ts.
// ─────────────────────────────────────────────────────────────────────────────
function WorkspaceCard({ data, onSaved }: { data: SettingsData; onSaved: () => void }) {
  const [pending, start] = useTransition();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await updateOrgName(fd);
      toast('Workspace name saved', 'success');
      onSaved();
    });
  }
  return (
    <Card className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md">
      <h2 className="text-sm font-semibold">Workspace</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The shared account your whole team works in. Renaming it here changes the name everyone sees.
      </p>
      {data.canEditOrg ? (
        <form onSubmit={onSubmit} className="mt-3 space-y-1.5">
          <Label htmlFor="org-name">Workspace name</Label>
          <div className="flex gap-2">
            <Input
              id="org-name"
              name="name"
              defaultValue={data.org?.name ?? ''}
              maxLength={80}
              required
              placeholder="e.g. Acme Sales"
            />
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Workspace name</span>
            <span className="font-medium">{data.org?.name ?? '-'}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Only a workspace owner or admin can change this name.
          </p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Plan</span>
        <Badge variant="secondary">{data.org?.plan ?? 'free'}</Badge>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Members card: read-only list of who shares this workspace.
// ─────────────────────────────────────────────────────────────────────────────
function MembersCard({ data }: { data: SettingsData }) {
  const { members, user } = data;
  return (
    <Card
      className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md"
      style={{ animationDelay: '80ms' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Team members</h2>
        <span className="text-xs text-muted-foreground">
          {members.length} {members.length === 1 ? 'person' : 'people'}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Everyone who can sign in to this workspace. The role badge shows what each person is allowed to do.
      </p>
      {members.length > 0 ? (
        <div className="mt-3 divide-y">
          {members.map((m, i) => (
            <div
              key={m.id}
              className="flex animate-fade-up items-center justify-between py-2 text-sm transition-colors hover:bg-muted/30"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div>
                <div className="font-medium">
                  {m.name ?? m.email}
                  {m.id === user.id && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </div>
              <Badge variant={m.role === 'owner' ? 'default' : 'muted'}>{m.role}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          You are the only person in this workspace right now. Invites are coming soon.
        </p>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile card: just this signed-in user's own details.
// ─────────────────────────────────────────────────────────────────────────────
function ProfileCard({ data, onSaved }: { data: SettingsData; onSaved: () => void }) {
  const { user } = data;
  const [pending, start] = useTransition();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await updateProfileName(fd);
      toast('Your name was saved', 'success');
      onSaved();
    });
  }
  return (
    <Card
      className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md"
      style={{ animationDelay: '160ms' }}
    >
      <h2 className="text-sm font-semibold">Your profile</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Just for you. This is the name your teammates see next to your activity.
      </p>
      <form onSubmit={onSubmit} className="mt-3 space-y-1.5">
        <Label htmlFor="profile-name">Your name</Label>
        <div className="flex gap-2">
          <Input
            id="profile-name"
            name="name"
            defaultValue={user.name ?? ''}
            maxLength={80}
            required
            placeholder="e.g. Jordan Lee"
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Your role</dt>
          <dd className="font-medium">{user.role}</dd>
        </div>
      </dl>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preferences card: view-only defaults stored in this browser (localStorage).
// Every control here writes a usePref key that a real page reads, so changing a
// default actually changes how that page looks the next time you open it.
// ─────────────────────────────────────────────────────────────────────────────
function PreferencesCard() {
  // One density choice drives every list surface (feed, events, companies). We
  // keep a single "settingsDensity" mirror for this card's own state and fan it
  // out to each surface's own key so those pages pick it up on their next load.
  const [density, setDensityMirror] = usePref<Density>('settingsDensity', 'comfortable');
  const [feedDensity, setFeedDensity] = usePref<Density>('feed-density', 'comfortable');
  const [eventsDensity, setEventsDensity] = usePref<Density>('events-density', 'comfortable');
  const [companiesDensity, setCompaniesDensity] = usePref<Density>('companies:density', 'comfortable');

  const [feedSort, setFeedSort] = usePref<FeedSort>('feedSort', 'newest');
  const [showCmdKHint, setShowCmdKHint] = usePref<boolean>('showCmdKHint', true);

  // Keep the card's own mirror in step with whatever the surfaces actually have,
  // so the toggle reflects reality if a surface was changed from its own bar.
  useEffect(() => {
    if (feedDensity !== density) setDensityMirror(feedDensity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedDensity]);

  const applyDensity = (value: Density) => {
    setDensityMirror(value);
    setFeedDensity(value);
    setEventsDensity(value);
    setCompaniesDensity(value);
  };

  // Open the feed pre-ordered by the chosen default. The feed reads its order
  // from the URL, so this link makes the chosen sort take effect immediately.
  const feedHref = feedSort === 'newest' ? '/feed' : `/feed?sort=${feedSort}`;

  /** Fire the same synthetic Cmd/Ctrl+K the sidebar uses, to open search now. */
  const openSearch = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }),
    );
  };

  // Suppress hydration mismatch: usePref renders its initial value on the server
  // pass, then hydrates from localStorage. Marking the interactive region as
  // mounted avoids a flash of the wrong toggle state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Card
      className="animate-fade-up p-5 transition-shadow duration-200 hover:shadow-md"
      style={{ animationDelay: '240ms' }}
    >
      <h2 className="text-sm font-semibold">View preferences</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        How the app looks for you. These are saved in this browser only, so each device can have its own
        defaults. They do not change anything for your teammates.
      </p>

      <div className="mt-4 space-y-5" suppressHydrationWarning>
        {/* Default list density: how tightly rows are packed everywhere. */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Rows3 className="size-4 text-muted-foreground" />
            Default list spacing
          </Label>
          <p className="text-xs text-muted-foreground">
            How tightly rows are packed in the feed, events, and companies lists. Comfortable is roomier;
            compact fits more on screen.
          </p>
          <div
            className="mt-1 inline-flex h-9 items-center rounded-md border border-input p-0.5"
            role="group"
            aria-label="Default list spacing"
          >
            <button
              type="button"
              aria-pressed={mounted && density === 'comfortable'}
              onClick={() => applyDensity('comfortable')}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded px-3 text-xs font-medium transition-colors duration-150',
                mounted && density === 'comfortable'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Rows3 className="size-3.5" /> Comfortable
            </button>
            <button
              type="button"
              aria-pressed={mounted && density === 'compact'}
              onClick={() => applyDensity('compact')}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded px-3 text-xs font-medium transition-colors duration-150',
                mounted && density === 'compact'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutList className="size-3.5" /> Compact
            </button>
          </div>
        </div>

        {/* Open the feed in a chosen order. This builds a link; the feed reads its
            order from the URL, so the button below applies the choice. */}
        <div className="space-y-1.5">
          <Label htmlFor="default-feed-sort" className="flex items-center gap-1.5">
            <ArrowDownWideNarrow className="size-4 text-muted-foreground" />
            Open the feed in this order
          </Label>
          <p className="text-xs text-muted-foreground">
            Pick an order, then use the button to open the feed sorted that way. Strength means how strong a buying
            sign it is. While you browse, the feed keeps its order in the page URL.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="default-feed-sort"
              aria-label="Order to open the feed in"
              className={selectCls}
              value={mounted ? feedSort : 'newest'}
              onChange={(e) => setFeedSort(e.target.value as FeedSort)}
            >
              {FEED_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} title={o.hint}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button asChild variant="secondary" size="sm">
              <a href={feedHref}>Open feed with this order</a>
            </Button>
          </div>
        </div>

        {/* Keyboard shortcut hint toggle. */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="cmdk-hint" className="flex items-center gap-1.5">
              <Keyboard className="size-4 text-muted-foreground" />
              Show the search keyboard shortcut
            </Label>
            <Switch
              id="cmdk-hint"
              checked={mounted ? showCmdKHint : true}
              onCheckedChange={(v) => setShowCmdKHint(v)}
              aria-label="Show the search keyboard shortcut hint"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Press Cmd+K (or Ctrl+K on Windows) anywhere to jump to any person, company, or signal. Turn this
            off to hide the on-screen reminder.
          </p>
          <div className="flex items-center gap-2">
            {mounted && showCmdKHint && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                <Search className="size-3.5" />
                Search
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium">
                  &#8984;K
                </kbd>
              </span>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={openSearch}>
              Try it now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function LoadingCards() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-40 w-full rounded-lg" />
      ))}
    </>
  );
}
