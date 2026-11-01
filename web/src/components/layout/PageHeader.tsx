import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: ReactNode;
  // Small label above the title, e.g. the page type ("Assessment", "Live monitor").
  eyebrow?: string;
  description?: ReactNode;
  // Parent page; renders a round back button labelled for screen readers.
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  eyebrow,
  description,
  backTo,
  backLabel = "Back",
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backTo && (
          <Link
            to={backTo}
            aria-label={backLabel}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-rakamin-teal">
              {eyebrow}
            </p>
          )}
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
