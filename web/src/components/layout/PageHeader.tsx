import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  back,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        {back}
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {subtitle && (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
