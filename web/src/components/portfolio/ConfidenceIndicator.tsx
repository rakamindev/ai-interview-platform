interface ConfidenceIndicatorProps {
  confidence: string; // "high" | "medium" | "low" from API
}

function getLabel(c: string): "HIGH" | "MEDIUM" | "LOW" {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  return "LOW";
}

export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);

  if (label === "HIGH") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Confidence: High
      </span>
    );
  }
  if (label === "MEDIUM") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
        Confidence: Medium
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Confidence: Low
    </span>
  );
}
