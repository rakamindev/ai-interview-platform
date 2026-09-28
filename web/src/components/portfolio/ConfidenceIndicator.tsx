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
      <span className="flex items-center gap-1 text-xs text-success">
        <span className="h-2 w-2 rounded-full bg-success" />
        Confidence: HIGH
      </span>
    );
  }
  if (label === "MEDIUM") {
    return (
      <span className="flex items-center gap-1 text-xs">
        <span className="h-2 w-2 rounded-full bg-warning" />
        Confidence: MEDIUM
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <span className="h-2 w-2 rounded-full bg-destructive" />
      Confidence: LOW
    </span>
  );
}
