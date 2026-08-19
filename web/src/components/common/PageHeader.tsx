import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-4 border-b", className)}>
      <div className="space-y-1 min-w-0 flex-1">
        {backHref && (
          <Link
            to={backHref}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{backLabel}</span>
          </Link>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground break-words">{title}</h1>
          {badge}
        </div>
        {description && (
          <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto shrink-0">{actions}</div>}
    </div>
  );
}
