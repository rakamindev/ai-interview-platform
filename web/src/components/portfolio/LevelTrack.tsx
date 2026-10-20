import { cn } from "@/lib/utils";
import { isLevel, levelLabel } from "@/utils/constants";

interface LevelTrackProps {
  /** Candidate's level; null when there is no evidence. */
  level: number | null;
  /** Vacancy's required level, drawn as an underline on that rung. */
  required?: number | null;
  /** Fills the gap below the required level in the shortfall colour. */
  highlightShortfall?: boolean;
  className?: string;
}

const RUNGS = [1, 2, 3, 4, 5];

/**
 * Five rungs, L1 to L5. Filled rungs are the candidate's evidenced level; the underlined rung is
 * the required level. With no evidence every rung is dashed, so "not assessed" can't read as L1.
 */
export default function LevelTrack({ level, required, highlightShortfall, className }: LevelTrackProps) {
  const assessed = isLevel(level);
  const description =
    (assessed ? `Candidate ${levelLabel(level)}` : "No evidence") + (isLevel(required) ? `, required L${required}` : "");

  return (
    <div role="img" aria-label={description} className={cn("flex items-end gap-1", className)}>
      {RUNGS.map((rung) => {
        const filled = assessed && rung <= level;
        const missing = highlightShortfall && assessed && isLevel(required) && rung > level && rung <= required;
        return (
          <span key={rung} className="flex w-5 flex-col items-stretch gap-[3px]" data-rung={rung}>
            <span
              data-state={!assessed ? "no-evidence" : filled ? "filled" : missing ? "shortfall" : "empty"}
              className={cn(
                "h-2.5 rounded-[2px]",
                !assessed && "border border-dashed border-unassessed",
                assessed && (filled ? "bg-evidence" : missing ? "bg-shortfall/25" : "bg-muted"),
              )}
            />
            <span
              data-required={rung === required || undefined}
              className={cn("h-[3px] rounded-full", rung === required ? "bg-required" : "bg-transparent")}
            />
          </span>
        );
      })}
    </div>
  );
}
