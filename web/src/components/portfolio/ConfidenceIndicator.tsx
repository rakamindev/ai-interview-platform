interface ConfidenceIndicatorProps {
  confidence: string; // "high" | "medium" | "low" from API
}

function getLabel(c: string): "HIGH" | "MEDIUM" | "LOW" {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  return "LOW";
}

/**
 * Confidence qualifies the level and never outshines it, so HIGH and MEDIUM
 * stay quiet (muted). LOW is an attention signal — yellow, never red: a
 * low-confidence rating is not a system failure.
 */
export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);

  if (label === "LOW") {
    return (
      <span className="flex items-center gap-1 text-xs text-attention">
        <span className="h-2 w-2 rounded-full bg-secondary" />
        Confidence: LOW
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-border" />
      Confidence: {label}
    </span>
  );
}
