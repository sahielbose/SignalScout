import { Radar } from 'lucide-react';

export const metadata = { title: 'Feed — Signal Scout' };

export default function FeedPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Radar className="size-6" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Your signal feed</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Once you define an ICP and the worker ingests sources, classified buying signals stream in
        here — filtered to the customers you care about. The live feed lands in Phase 6.
      </p>
    </div>
  );
}
