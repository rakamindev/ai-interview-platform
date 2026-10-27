import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AssessmentFormSkeleton() {
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

          {/* Time limit & language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Skills section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>

            {/* Simulated 2 skill cards with drag handles & levels */}
            <div className="space-y-2.5">
              {[1, 2].map((i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                  <div className="pt-1 flex gap-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <Skeleton key={lvl} className="h-6 w-14 rounded-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-44 rounded-md" />
              <Skeleton className="h-8 w-36 rounded-md" />
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Skeleton className="h-10 w-20 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
