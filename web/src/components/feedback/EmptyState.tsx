import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  /** Why it is empty, in one or two sentences. */
  description?: ReactNode;
  /** The one action that fills it, usually a small outline Button or Link. */
  action?: ReactNode;
}

/** Nothing to show yet. Says why, and offers the single next step instead of a bare "No data". */
export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-8 text-center sm:p-10">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
