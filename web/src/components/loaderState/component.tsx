import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export function LoadingStateVacancy() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="w-40 h-6" />
          <Skeleton className="w-64 h-4 max-w-full" />
        </div>

        <Skeleton className="rounded-full h-7 w-28" />
      </div>

      {/* Vacancy card skeletons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              {/* Icon and action */}
              <div className="flex items-start justify-between">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="w-8 h-8 rounded-full" />
              </div>

              {/* Title and description */}
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Skeleton className="w-4/5 h-5" />
                  <Skeleton className="w-3/5 h-5" />
                </div>

                <Skeleton className="h-3.5 w-40" />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 mt-4 border-t">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function LoadingStateAsesment() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="w-8 h-8 rounded-full" />
            </div>

            <div className="mt-4 space-y-3">
              <Skeleton className="w-4/5 h-5" />
              <Skeleton className="w-2/5 h-4" />

              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>

            <div className="pt-3 mt-4 border-t">
              <Skeleton className="h-3.5 w-28" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
