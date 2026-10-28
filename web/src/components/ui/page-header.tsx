import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  // The visible label is also the accessible name, e.g. "Back to vacancies".
  back?: { to: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}

// The page's only h1, with an optional back link, description and actions.
// The h1 takes focus (tabIndex -1) so pages can move focus to it after an action.
export const PageHeader = React.forwardRef<HTMLHeadingElement, PageHeaderProps>(function PageHeader(
  { title, description, back, actions, className },
  ref,
) {
  return (
    <div className={cn("space-y-2", className)}>
      {back && (
        <Link to={back.to}
              className="inline-flex max-sm:min-h-11 items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 ref={ref} tabIndex={-1}
              className="rounded-sm text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {title}
          </h1>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:justify-end max-sm:*:flex-1">{actions}</div>}
      </div>
    </div>
  );
});
