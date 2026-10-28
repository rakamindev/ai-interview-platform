import React from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type NetworkHealthState = "connected" | "reconnecting" | "offline";

export interface NetworkHealthPillProps {
  state: NetworkHealthState;
  countdownSeconds?: number;
  className?: string;
}

export function NetworkHealthPill({
  state,
  countdownSeconds,
  className,
}: NetworkHealthPillProps) {
  if (state === "connected") {
    return (
      <div
        data-testid="network-health-connected"
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60",
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <Wifi className="h-3 w-3 text-emerald-600" />
        <span>Connected • Stable</span>
      </div>
    );
  }

  if (state === "reconnecting") {
    return (
      <div
        data-testid="network-health-reconnecting"
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60",
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
        <span>
          Reconnecting...
          {typeof countdownSeconds === "number" && countdownSeconds > 0
            ? ` (${countdownSeconds}s)`
            : ""}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="network-health-offline"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60",
        className
      )}
    >
      <WifiOff className="h-3 w-3 text-rose-600" />
      <span>Offline</span>
    </div>
  );
}

export default NetworkHealthPill;
