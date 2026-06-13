import { Target, Radar, FileSearch, Send } from 'lucide-react';

const steps = [
  {
    icon: Target,
    title: 'Tell us who you sell to',
    body: 'Describe the kind of customer you sell to, like company size, industry, or location. That is all the setup you need.',
  },
  {
    icon: Radar,
    title: 'We watch for buying moments',
    body: 'We watch free public sources and show you the moment a matching company looks ready to buy, like raising money, hiring sales roles, or shipping a product.',
  },
  {
    icon: FileSearch,
    title: 'Research anyone in one click',
    body: 'Pick a person and get a clean research profile in seconds, where every fact links back to the public source it came from.',
  },
  {
    icon: Send,
    title: 'Send it to your tools',
    body: 'Push any feed or profile into your CRM and other tools as a CSV file, over our API, or through a connected MCP server.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
          How it works
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          From your ideal customer to a warm conversation, in four steps.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-[hsl(var(--muted-foreground))]">
          You tell us the kind of customer you sell to, and we surface the public moments that suggest a company is
          ready to buy, then hand you a source-backed profile to act on. No scraping, no guesswork.
        </p>
        <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li
              key={step.title}
              style={{ animationDelay: `${i * 60}ms` }}
              className="group animate-fade-up rounded-xl border border-border bg-[hsl(var(--card))] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-sm font-semibold text-[hsl(var(--accent-foreground))]">
                  {i + 1}
                </span>
                <step.icon className="size-5 text-[hsl(var(--terracotta))] transition-transform duration-200 group-hover:scale-110" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
