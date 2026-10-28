import { Skeleton } from "@/components/ui/skeleton";

// Same blocks as the loaded page: header, summary, skill cards.
export default function PortfolioSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading portfolio" className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-[4.5rem]" />)}
      </div>
      {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-40 w-full" />)}
    </div>
  );
}
