import { LayoutDashboard, Plug, FileSpreadsheet } from 'lucide-react';

const cards = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    body: 'A live ICP-filtered feed with research, saved lists, and CSV export, ready the moment you sign in.',
  },
  {
    icon: Plug,
    title: 'MCP and API',
    body: 'A first-class MCP server and a REST API, so Claude, Cursor, or your own scripts can query signals directly.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Flat files and CSV',
    body: 'Export any feed or dossier to clean CSV for your CRM, spreadsheet, or data warehouse.',
  },
];

export function IntegrationsSection() {
  return (
    <section
      id="integrations"
      className="scroll-mt-20 bg-[hsl(var(--ink-section))] text-[hsl(var(--ink-section-foreground))]"
    >
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--terracotta))]">
          Plugs into your stack
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Use it where your team already works.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-[hsl(var(--ink-section-border))] bg-[hsl(var(--ink-section-card))] p-6"
            >
              <c.icon className="size-6 text-[hsl(var(--terracotta))]" />
              <h3 className="mt-4 text-lg font-medium">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--ink-section-muted))]">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
