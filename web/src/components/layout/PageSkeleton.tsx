import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for <PageHeader>: same rows and sizes, so the page does not shift when data arrives. */
export function PageHeaderSkeleton({ back = true, subtitle = true, actions = 0 }: { back?: boolean; subtitle?: boolean; actions?: number }) {
  return (
    <div className="space-y-1">
      {back && <Skeleton className="h-4 w-28 my-3.5 sm:my-2" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 max-w-full" />
          {subtitle && <Skeleton className="h-4 w-40" />}
        </div>
        {actions > 0 && (
          <div className="flex gap-2">
            {Array.from({ length: actions }, (_, i) => (
              <Skeleton key={i} className="h-9 w-20" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Wraps a page-shaped skeleton and announces the load to screen readers. */
export default function PageSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={`Loading ${label}`} className="space-y-6">
      {children}
      <span className="sr-only">Loading {label}…</span>
    </div>
  );
}
