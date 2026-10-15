import { cn } from "@/lib/utils";
import type { Confidence } from "@/types";

interface ConfidenceIndicatorProps {
  confidence: Confidence;
  probeCount?: number | null;
  coverageState?: string | null;
}

const STYLES: Record<Confidence, { label: string; dot: string; text: string }> = {
  high: { label: "High confidence", dot: "bg-green-600", text: "text-green-700" },
  medium: { label: "Medium confidence", dot: "bg-amber-500", text: "text-amber-700" },
  low: { label: "Low confidence", dot: "bg-red-600", text: "text-red-700" },
};

const COVERAGE_WORDS: Record<string, string> = {
  covered: "fully covered",
  partial: "partly covered",
  initiated: "only opened",
};

// Confidence is computed from how much the interview probed the skill, so we
// say that next to it instead of leaving assessors to guess what it means.
export function confidenceReason(probeCount?: number | null, coverageState?: string | null) {
  if (probeCount == null) return null;
  const probes = `${probeCount} ${probeCount === 1 ? "question" : "questions"}`;
  const coverage = coverageState ? COVERAGE_WORDS[coverageState] : null;
  return coverage ? `${probes}, ${coverage}` : probes;
}

export default function ConfidenceIndicator({ confidence, probeCount, coverageState }: ConfidenceIndicatorProps) {
  const style = STYLES[confidence] ?? STYLES.low;
  const reason = confidenceReason(probeCount, coverageState);

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 text-xs", style.text)}>
      <span aria-hidden className={cn("h-2 w-2 rounded-full", style.dot)} />
      <span className="font-medium">{style.label}</span>
      {reason && <span className="text-muted-foreground">· {reason}</span>}
    </span>
  );
}
