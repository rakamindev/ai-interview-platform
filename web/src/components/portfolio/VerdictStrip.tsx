import type { SessionVerdict } from "@/types";
import { formatDuration } from "@/lib/format";

const END_REASON_LABELS: Record<string, string> = {
  manual_candidate: "Candidate ended",
  manual_assessor: "Assessor ended",
  all_covered: "All skills covered",
  time_ceiling: "Time limit reached",
  error: "Session error",
};

interface VerdictStripProps {
  verdict: SessionVerdict;
}

export default function VerdictStrip({ verdict }: VerdictStripProps) {
  const endLabel = verdict.end_reason
    ? END_REASON_LABELS[verdict.end_reason] ?? verdict.end_reason
    : "Session ended";

  return (
    <div className="rounded-lg border bg-muted/30 p-4 sm:p-5">
      <p className="font-verdict text-lg sm:text-xl text-foreground leading-snug">
        {endLabel}
        {verdict.duration_seconds != null && (
          <span className="text-muted-foreground font-sans text-base sm:text-lg">
            {" "}
            · {formatDuration(verdict.duration_seconds)}
          </span>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground font-sans">
        <span>
          <strong className="text-foreground">{verdict.assessed_count}</strong> assessed
        </span>
        <span>
          <strong className="text-foreground">{verdict.not_assessed_count}</strong> not assessed
        </span>
        {verdict.low_confidence_count > 0 && (
          <span>
            <strong className="text-amber-700">{verdict.low_confidence_count}</strong> low confidence
          </span>
        )}
      </div>
    </div>
  );
}
