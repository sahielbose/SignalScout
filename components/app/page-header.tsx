export function PageHeader({
  title,
  description,
  helper,
  children,
}: {
  title: string;
  description?: string;
  /** Optional one-line, plain-words hint shown under the description (e.g. "Tip: ..."). */
  helper?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex animate-fade-down flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
        {helper && (
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground/80">
            {helper}
          </p>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
