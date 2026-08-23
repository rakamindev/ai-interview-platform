import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import StatsGrid from "@/shared/components/StatsGrid";

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="py-4 px-4 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function StatsGridSkeleton({ columns }: { columns: 2 | 3 }) {
  return (
    <StatsGrid columns={columns}>
      {Array.from({ length: columns }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </StatsGrid>
  );
}
