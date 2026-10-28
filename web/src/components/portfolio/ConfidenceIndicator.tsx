import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CONFIDENCE_LABEL } from "@/lib/portfolio";
import { cn } from "@/lib/utils";
import type { Confidence } from "@/types";

interface ConfidenceIndicatorProps {
  confidence: Confidence | null | undefined;
  /** Shown on hover/focus: why the confidence is what it is. */
  reason?: string;
}

const DOT: Record<Confidence, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-400",
  low: "bg-rose-500",
};

const TEXT: Record<Confidence, string> = {
  high: "text-emerald-700",
  medium: "text-amber-700",
  low: "text-rose-700",
};

export default function ConfidenceIndicator({ confidence, reason }: ConfidenceIndicatorProps) {
  if (!confidence || !CONFIDENCE_LABEL[confidence]) return null;

  const label = (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", TEXT[confidence])}>
      <span className={cn("h-2 w-2 rounded-full", DOT[confidence])} aria-hidden />
      {CONFIDENCE_LABEL[confidence]}
    </span>
  );

  if (!reason) return label;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-xs">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
