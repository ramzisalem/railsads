import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-soft">
          <Icon className="h-6 w-6 text-secondary-dark" />
        </div>
        <h3 className="heading-md">{title}</h3>
        <p className="mt-2 text-body text-muted-foreground">{description}</p>
        {action && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
