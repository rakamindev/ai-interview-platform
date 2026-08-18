import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center",
        className
      )}
    >
      <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
      <p className="font-medium text-sm text-destructive">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto break-words">
          {description}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingBlock({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-20 w-full animate-pulse rounded-xl border bg-muted/40"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
