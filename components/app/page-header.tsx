import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function PageHeader({
  title,
  description,
  helper,
  actions,
  children,
  backHref,
  backLabel,
}: {
  title: string;
  description?: string;
  /**
   * Optional one-line, plain-words hint shown under the description, e.g.
   * "Tip: an ICP is the kind of customer you sell to." Keep it jargon-free.
   */
  helper?: React.ReactNode;
  /**
   * Right-aligned controls for this page (buttons, toggles, a saved-views
   * menu, an export action). Prefer this over `children`; both render in the
   * same actions area, with `actions` first.
   */
  actions?: React.ReactNode;
  /** Back-compat alias for `actions`; renders in the same right-aligned area. */
  children?: React.ReactNode;
  /** When set, shows a "Back" link above the title (use on detail pages). */
  backHref?: string;
  /** Label for the back link. Defaults to "Back". */
  backLabel?: string;
}) {
  const hasActions = Boolean(actions || children);
  return (
    <div className="flex animate-fade-down flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-1.5 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" />
            {backLabel ?? 'Back'}
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        {helper && (
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground/80">{helper}</p>
        )}
      </div>
      {hasActions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}
