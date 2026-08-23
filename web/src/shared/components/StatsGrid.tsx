import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface StatsGridProps {
  columns: 2 | 3;
  children: ReactNode;
  className?: string;
}

export default function StatsGrid({ columns, children, className }: StatsGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3",
        columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
