import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Renders a back arrow linking here, placed before the title. */
  backTo?: string;
  /** Right-aligned slot — button, status badge, timer, etc. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Page-level heading used across assessor pages: title (+ optional back
 * link and subtitle) on the left, actions on the right. Replaces the
 * `<h1 className="text-lg font-semibold">` markup that used to be
 * copy-pasted per page.
 */
export default function PageHeader({ title, subtitle, backTo, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {backTo && (
            <Link to={backTo} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <h1 className="font-display text-xl font-semibold">{title}</h1>
        </div>
        {subtitle && (
          <p className={cn("text-sm text-muted-foreground", backTo && "pl-6")}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
