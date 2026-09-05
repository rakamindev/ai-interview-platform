import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoverageSource } from "@/types";

interface ConfidenceIndicatorProps {
  confidence: string; // "high" | "medium" | "low" from API
  coveredBy?: CoverageSource;
}

type Level = "HIGH" | "MEDIUM" | "LOW";

const STYLES: Record<Level, { dot: string; text: string }> = {
  HIGH: { dot: "bg-green-500", text: "text-green-600" },
  MEDIUM: { dot: "bg-amber-400", text: "" },
  LOW: { dot: "bg-destructive", text: "text-destructive" },
};

function getLabel(c: string): Level {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  return "LOW";
}

export default function ConfidenceIndicator({
  confidence,
  coveredBy,
}: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);
  const style = STYLES[label];

  // Covered on probe count alone, with no evidence check behind the rating.
  const unverified = false;

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={cn("flex items-center gap-1 text-xs", style.text)}>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
        Confidence: {label}
      </span>

      {unverified && (
        <span
          title="Promoted by the analysis window timeout, not by an evidence check"
          className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700"
        >
          <ShieldAlert className="h-3 w-3 shrink-0" />
          Unverified
        </span>
      )}
    </span>
  );
}
