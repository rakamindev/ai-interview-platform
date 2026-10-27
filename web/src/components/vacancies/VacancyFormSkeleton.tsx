import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function VacancyFormSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading form" className="space-y-6">
      {/* Header skeleton: back link, title, description */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Main card skeleton */}
      <Card>
        <CardContent className="space-y-6 p-4 sm:p-6">
          {/* Role title */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          <div className="border-t border-border/50" />

          {/* Expected skills */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Simulated 2 skill cards */}
            <div className="space-y-2.5">
              {[1, 2].map((i) => (
                <div key={i} className="border rounded-lg p-3.5 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <div className="flex gap-3">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <Skeleton key={lvl} className="h-6 w-12 rounded-full" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Skeleton className="h-9 w-36 rounded-md" />
          </div>

          <div className="border-t border-border/50" />

          {/* Company culture */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>

          {/* Competency expectations */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-border/50">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
