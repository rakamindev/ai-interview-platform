import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

interface ListRowSkeletonProps {
  /** Leading circular avatar (candidate rows) instead of a trailing chevron dot (entity rows). */
  avatar?: boolean;
}

export default function ListRowSkeleton({ avatar }: ListRowSkeletonProps) {
  return (
    <Card>
      <CardContent
        className={cn(
          "flex items-center gap-4",
          avatar ? "py-4 px-6" : "py-5 px-6 justify-between gap-6",
        )}
      >
        {avatar && <Skeleton className="h-11 w-11 rounded-full shrink-0" />}
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className={avatar ? "h-4 w-32" : "h-4 w-40"} />
          <Skeleton className="h-3 w-48" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        {!avatar && <Skeleton className="h-4 w-4 rounded-full shrink-0" />}
      </CardContent>
    </Card>
  );
}
