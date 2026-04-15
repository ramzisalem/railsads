interface PageHeaderProps {
  title: string;
  description?: string;
  /** Renders below the title (e.g. thread switcher). */
  subheader?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  subheader,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="heading-xl truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-body text-muted-foreground">{description}</p>
        )}
        {subheader && (
          <div
            className={
              description
                ? "mt-3 min-w-0 w-full max-w-2xl"
                : "mt-4 min-w-0 w-full max-w-2xl"
            }
          >
            {subheader}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
