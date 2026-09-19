import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetaChipProps {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function MetaChip({ icon, children, className }: MetaChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt px-2.5 py-0.5 text-xs text-muted-foreground",
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
