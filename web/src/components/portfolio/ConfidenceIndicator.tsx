interface ConfidenceIndicatorProps {
  confidence: string; // "high" | "medium" | "low" from API
}

function getLabel(c: string): "high" | "medium" | "low" {
  const normalized = c?.toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const label = getLabel(confidence);

  if (label === "high") {
    return (
      <span className="flex items-center gap-1 text-xs text-verdict-match">
        <span className="h-2 w-2 rounded-full bg-verdict-match" />
        High confidence
      </span>
    );
  }
  if (label === "medium") {
    return (
      <span className="flex items-center gap-1 text-xs text-verdict-gap">
        <span className="h-2 w-2 rounded-full bg-verdict-gap" />
        Medium confidence
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-verdict-unknown">
      <span className="h-2 w-2 rounded-full bg-verdict-unknown" />
      Low confidence
    </span>
  );
}
