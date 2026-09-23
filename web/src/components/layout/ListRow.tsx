import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ListRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}

export default function ListRow({
  title,
  meta,
  trailing,
  className,
  ...props
}: ListRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-3 border-b border-foreground/10 bg-card/50 px-3 py-3.5 sm:px-4 transition-colors hover:bg-accent/40",
        className
      )}
      {...props}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="font-medium text-sm text-foreground truncate">{title}</div>
        {meta && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {meta}
          </div>
        )}
      </div>
      {trailing && (
        <div className="flex items-center gap-1 shrink-0">{trailing}</div>
      )}
    </div>
  );
}
