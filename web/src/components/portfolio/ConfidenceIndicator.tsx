interface ConfidenceIndicatorProps {
  confidence: string | null; // "high" | "medium" | "low" from API, or null (not assessed)
}

function getLabel(c: string | null): "HIGH" | "MEDIUM" | "LOW" | "NONE" {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "HIGH";
  if (normalized === "medium") return "MEDIUM";
  if (normalized === "low") return "LOW";
  return "NONE";
}

export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);

  if (label === "NONE") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-neutral-300" />
        Confidence: —
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
