import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  variant?: "spinner" | "skeleton" | "centered";
  message?: string;
  rows?: number;
  className?: string;
}

export default function LoadingState({
  variant = "spinner",
  message = "Loading...",
  rows = 3,
  className,
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className={cn("space-y-3 w-full", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-12 text-center",
          className
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground py-4", className)}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span className="text-xs">{message}</span>
    </div>
  );
}
