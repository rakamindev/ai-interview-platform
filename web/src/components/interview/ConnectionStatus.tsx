import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  state: "connected" | "reconnecting" | "lost";
  className?: string;
}

export default function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  if (state === "connected") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-success rounded-full border border-success/20 bg-success-muted px-2.5 py-1",
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" aria-hidden />
        Connected
      </div>
    );
  }
  if (state === "reconnecting") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1",
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
        Reconnecting…
      </div>
    );
  }
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-destructive rounded-full border border-destructive/25 bg-destructive/5 px-2.5 py-1",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" aria-hidden />
      Connection lost
    </div>
  );
}
