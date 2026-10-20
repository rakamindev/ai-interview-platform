import { cn } from "@/lib/utils";
import type { Confidence } from "@/types";

interface ConfidenceIndicatorProps {
  /** null for not-assessed skills: nothing to show. */
  confidence: Confidence | null;
}

const STEPS: Confidence[] = ["low", "medium", "high"];

const LABELS: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

// Low confidence is a prompt to look closer, not an error: amber, never destructive red.
export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  if (!confidence) return null;
  const rank = STEPS.indexOf(confidence);

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", confidence === "low" ? "text-attention" : "text-muted-foreground")}>
      <span aria-hidden className="flex gap-[2px]">
        {STEPS.map((step, i) => (
          <span key={step} className={cn("h-2 w-1 rounded-full bg-current", i > rank && "opacity-25")} />
        ))}
      </span>
      {LABELS[confidence]}
    </span>
  );
}
