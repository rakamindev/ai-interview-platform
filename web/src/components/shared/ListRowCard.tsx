import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

/** Clickable list row with denser layout + mobile-safe truncation. */
export function ListRowCard({
  title,
  meta,
  trailing,
  onClick,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }
          : undefined
      }
      className={cn(
        "group border-border/80 shadow-none transition-all duration-200",
        onClick &&
        "cursor-pointer hover:border-primary/35 hover:bg-primary/[0.03] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <CardContent className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="font-medium text-sm leading-snug break-words [overflow-wrap:anywhere]">
            {title}
          </div>
          {meta && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          {onClick && (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
