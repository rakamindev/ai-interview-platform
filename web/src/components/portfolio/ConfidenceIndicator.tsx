interface ConfidenceIndicatorProps {
  confidence: string | null; // "high" | "medium" | "low" | null (when unassessed)
}

function getLabel(c: string | null): "HIGH" | "MEDIUM" | "LOW" | null {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  if (normalized === "low") return "LOW";
  return null;
}

export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);

  if (label == null) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-muted" />
        Not rated this session
      </span>
    );
  }

  if (label === "HIGH") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Confidence: HIGH
      </span>
    );
  }
  if (label === "MEDIUM") {
    return (
      <span className="flex items-center gap-1 text-xs">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
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