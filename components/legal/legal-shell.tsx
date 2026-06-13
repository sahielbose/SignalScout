/**
 * Article shell for the legal pages. Nav and footer are provided by the
 * (marketing) layout, so this renders the document body only. Reads the warm
 * marketing theme tokens via hsl(var(--x)).
 */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Last updated {updated}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))] [&_a]:text-[hsl(var(--accent))] [&_a]:underline-offset-4 hover:[&_a]:underline [&_code]:text-[hsl(var(--foreground))] [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[hsl(var(--foreground))] [&_li]:marker:text-[hsl(var(--muted-foreground))] [&_strong]:text-[hsl(var(--foreground))] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
      <p className="mt-10 rounded-md border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.06)] p-3 text-xs text-[hsl(var(--accent))]">
        This is a template provided with the open-source project, not legal advice. Have counsel review and adapt it
        before operating SignalScout for real users.
      </p>
    </article>
  );
}
