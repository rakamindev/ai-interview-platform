import type { Confidence } from "@/types";

interface ConfidenceIndicatorProps {
  confidence: Confidence | null;
}

/**
 * Renders nothing when there is no confidence value.
 *
 * This previously defaulted anything unrecognised — including null — to
 * "Confidence: LOW" in red. That is a definite claim about a rating that may
 * not exist, which is the same class of error as rating an unprobed skill L1.
 */
export default function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  if (!confidence) return null;

  const styles: Record<Confidence, { dot: string; text: string }> = {
    high: { dot: "bg-green-500", text: "text-green-600" },
    medium: { dot: "bg-amber-400", text: "" },
    low: { dot: "bg-destructive", text: "text-destructive" },
  };
  const style = styles[confidence];

  return (
    <span className={`flex items-center gap-1 text-xs ${style.text}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      Confidence: {confidence.toUpperCase()}
    </span>
  );
}
