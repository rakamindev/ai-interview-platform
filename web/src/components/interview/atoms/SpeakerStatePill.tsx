import React from "react";
import { Bot, Mic, Loader2, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type SpeakerState = "ai" | "candidate" | "processing" | "idle";

export interface SpeakerStatePillProps {
  state: SpeakerState;
  className?: string;
}

export function SpeakerStatePill({ state, className }: SpeakerStatePillProps) {
  switch (state) {
    case "ai":
      return (
        <div
          data-testid="speaker-state-ai"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200/80 shadow-sm",
            className
          )}
        >
          <Bot className="h-3.5 w-3.5 text-slate-600" />
          <span>AI Speaking</span>
        </div>
      );
    case "candidate":
      return (
        <div
          data-testid="speaker-state-candidate"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm",
            className
          )}
        >
          <Mic className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
          <span>Listening... Your turn</span>
        </div>
      );
    case "processing":
      return (
        <div
          data-testid="speaker-state-processing"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200/80 shadow-sm",
            className
          )}
        >
          <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
          <span>Processing...</span>
        </div>
      );
    case "idle":
    default:
      return (
        <div
          data-testid="speaker-state-idle"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200",
            className
          )}
        >
          <Minus className="h-3.5 w-3.5 text-neutral-400" />
          <span>Ready</span>
        </div>
      );
  }
}

export default SpeakerStatePill;
