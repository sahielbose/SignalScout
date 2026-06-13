import { Reveal } from '@/components/ui/reveal';
import { ResearchTrace } from './research-trace';
import { DossierMock } from './dossier-mock';

export function ResearchSection() {
  return (
    <section id="research" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--accent))]">Deep research agent</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Research a person, get a cited profile.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-[hsl(var(--muted-foreground))]">
          Point it at someone in your feed and it reads their public footprint, then returns a structured dossier where
          every fact links to its source.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <ResearchTrace />
          </Reveal>
          <Reveal delay={120}>
            <DossierMock />
          </Reveal>
        </div>
        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          Every fact carries a clickable source. Uncited facts are dropped before you ever see them.
        </p>
      </div>
    </section>
  );
}
