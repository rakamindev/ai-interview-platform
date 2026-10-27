interface ConfidenceIndicatorProps {
  confidence: string; // "high" | "medium" | "low" from API
}

const STYLES = {
  high: { label: "High confidence", text: "text-green-700", dot: "bg-green-600" },
  medium: { label: "Medium confidence", text: "text-foreground", dot: "bg-amber-400" },
  low: { label: "Low confidence", text: "text-red-700", dot: "bg-red-600" },
} as const;

/**
 * Displays a color-coded dot and label indicating AI evaluation confidence.
 * Use it alongside candidate skill ratings to show whether confidence is high, medium, or low.
 */
export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const key = confidence?.toLowerCase();
  const style = key === "high" || key === "medium" ? STYLES[key] : STYLES.low;

  return (
    <span className={`flex items-center gap-1.5 text-xs ${style.text}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}
