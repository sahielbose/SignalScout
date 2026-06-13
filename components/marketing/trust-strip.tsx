import { ShieldCheck, Fingerprint, Globe, Gauge } from 'lucide-react';

const items = [
  { icon: ShieldCheck, label: 'Cited dossiers', note: 'Every fact links to a public source. Uncited claims are dropped.' },
  { icon: Fingerprint, label: 'Strong-key entity resolution', note: 'People match on verified keys only, never on name alone.' },
  { icon: Globe, label: 'Free public sources only', note: 'No LinkedIn or X scraping. No breached or bought data.' },
  { icon: Gauge, label: 'Cost guards', note: 'Per-org budget ceilings and quotas keep spend predictable.' },
];

export function TrustStrip() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label}>
            <it.icon className="size-5 text-[hsl(var(--accent))]" />
            <p className="mt-3 text-sm font-semibold">{it.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{it.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
