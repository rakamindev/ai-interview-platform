import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ListRowProps {
  to: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}

// One row of a list page: the whole row is a link, so it works with Tab and
// Enter. Render inside a <ul>.
export function ListRow({ to, title, meta, status, className }: ListRowProps) {
  return (
    <li>
      <Link to={to}
            className={cn(
              "group flex items-center gap-4 rounded-lg border bg-card px-4 py-3 shadow-sm transition-colors",
              "hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium [overflow-wrap:anywhere]">{title}</p>
          {meta && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{meta}</div>}
        </div>
        {status && <div className="shrink-0">{status}</div>}
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
