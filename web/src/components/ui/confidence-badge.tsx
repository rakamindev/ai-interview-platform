import { Shield, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Confidence = "high" | "medium" | "low";

const CONFIDENCE: Record<Confidence, { label: string; icon: LucideIcon; className: string }> = {
  high: { label: "High", icon: ShieldCheck, className: "border-green-200 bg-green-50 text-green-800" },
  medium: { label: "Medium", icon: Shield, className: "border-slate-300 bg-slate-50 text-slate-800" },
  low: { label: "Low", icon: ShieldAlert, className: "border-amber-200 bg-amber-50 text-amber-900" },
};

// Same rule as the backend (PRD-01 section 5).
const EXPLANATION =
  "Confidence comes from how often the interview probed this skill: high is 3 or more probes with full " +
  "coverage, medium is 2 probes or partial coverage, low is 1 probe or less. Low confidence is not counted " +
  "toward fit until an assessor reviews it.";

export function probeText(count: number | null | undefined): string {
  if (count == null) return "probes not recorded";
  return count === 1 ? "1 probe" : `${count} probes`;
}

export interface ConfidenceBadgeProps {
  confidence: Confidence;
  probeCount?: number | null;
  className?: string;
}

// A focusable badge, so the explanation is reachable by keyboard as well.
export function ConfidenceBadge({ confidence, probeCount, className }: ConfidenceBadgeProps) {
  const { label, icon: Icon, className: tone } = CONFIDENCE[confidence];
  const probes = probeText(probeCount);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${label} confidence, ${probes}`}
            className={cn(
              "touch-target inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              tone,
              className,
            )}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
            <span aria-hidden="true">·</span>
            <span>{probes}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{EXPLANATION}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
