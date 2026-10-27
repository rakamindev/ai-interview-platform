import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  backTo?: string;
  backLabel?: string;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** The one page header every assessor screen uses: where you came from, what this is, what you can do. */
export default function PageHeader({
  backTo,
  backLabel = "Back",
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-1", className)}>
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex min-h-11 sm:min-h-8 items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground break-words">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
