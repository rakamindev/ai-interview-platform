import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface StateViewProps {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  onRetry: () => void;
  emptyContent?: ReactNode;
  loadingContent?: ReactNode;
  children: ReactNode;
}

export default function StateView({
  loading,
  error,
  empty = false,
  onRetry,
  emptyContent = <p className="text-sm text-muted-foreground">No data available.</p>,
  loadingContent,
  children,
}: StateViewProps) {
  if (loading) {
    return loadingContent ?? (
      <div className="space-y-3" aria-label="Loading" role="status">
        <span className="sr-only">Loading content</span>
        {[1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-4 rounded-lg border p-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        aria-live="assertive"
      >
        <p>{error}</p>
        <Button variant="outline" size="sm" className="min-h-10 sm:min-h-8" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-lg border p-8 text-center">
        {emptyContent}
      </div>
    );
  }

  return <>{children}</>;
}
