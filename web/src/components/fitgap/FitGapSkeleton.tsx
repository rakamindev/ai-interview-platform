import { Skeleton } from "@/components/ui/skeleton";

// Same blocks as the loaded page: header, six counts, coverage, rows.
export default function FitGapSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading fit/gap report" className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[4.5rem]" />)}
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="space-y-3 rounded-lg border p-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
      </div>
    </div>
  );
}
