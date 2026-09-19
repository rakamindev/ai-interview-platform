import { cn } from "@/lib/utils";
import { CONFIDENCE_LABELS } from "@/utils/constants";

type ConfidenceKey = "high" | "medium" | "low";

const toneClasses: Record<ConfidenceKey, string> = {
  high: "text-ok",
  medium: "text-warn",
  low: "text-danger",
};

interface ConfidenceIndicatorProps {
  confidence: string; // "high" | "medium" | "low" from API
}

export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const normalized = confidence?.toLowerCase();
  const key: ConfidenceKey =
    normalized === "high" || normalized === "medium" || normalized === "low"
      ? normalized
      : "low";

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", toneClasses[key])}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {CONFIDENCE_LABELS[key]}
    </span>
  );
}
