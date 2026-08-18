import { cn } from "@/lib/utils";
import { COVERAGE_SEGMENTS_FILLED, COVERAGE_STATE_LABELS } from "@/utils/constants";

const SEGMENTS = [1, 2, 3];

interface CoverageTrackProps {
  state: string;
  className?: string;
}

/**
 * How far the interview has got into one skill, drawn with the same segment
 * grammar as LevelTrack so the product has a single visual language for
 * "progress along a scale".
 *
 * A skill nobody has asked about yet is drawn dashed and empty — the same
 * treatment an unassessed level gets on the report — so the two screens agree
 * that "no reading" is its own state and not a bad score. On this screen that
 * distinction is still actionable: the interview is running, and an untouched
 * skill can still be probed.
 */
export default function CoverageTrack({ state, className }: CoverageTrackProps) {
  const filledCount = COVERAGE_SEGMENTS_FILLED[state] ?? 0;
  const untouched = filledCount === 0;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="img"
      aria-label={COVERAGE_STATE_LABELS[state] ?? state}
    >
      {SEGMENTS.map((segment) => (
        <span
          key={segment}
          className={cn(
            "h-2 w-6 rounded-[2px] border transition-colors",
            segment <= filledCount
              ? "border-ok bg-ok"
              : untouched
              ? "border-dashed border-result-none/50 bg-transparent"
              : "border-border bg-muted",
          )}
        />
      ))}
    </div>
  );
}
