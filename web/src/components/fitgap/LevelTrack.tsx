import { cn } from "@/lib/utils";
import type { SkillComparisonResult } from "@/types";
import { RESULT_META } from "./resultMeta";

const LEVELS = [1, 2, 3, 4, 5];

interface LevelTrackProps {
  required: number | null;
  candidate: number | null;
  result: SkillComparisonResult;
}

/**
 * Five-step track: filled segments = candidate level, ring = required level.
 * Reads at a glance on a phone without needing column headers.
 */
export default function LevelTrack({ required, candidate, result }: LevelTrackProps) {
  const label =
    `Required ${required ? `L${required}` : "not set"}, ` + `candidate ${candidate ? `L${candidate}` : "not assessed"}`;

  return (
    <div className="flex items-center gap-1" role="img" aria-label={label} title={label}>
      {LEVELS.map((level) => {
        const filled = candidate != null && level <= candidate;
        const isRequired = required === level;
        return (
          <span
            key={level}
            data-testid={`level-${level}`}
            data-filled={filled || undefined}
            data-required={isRequired || undefined}
            className={cn(
              "relative h-2.5 w-6 rounded-full transition-colors sm:w-7",
              filled ? RESULT_META[result].fill : "bg-muted",
              candidate == null && "bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_3px,transparent_3px_6px)]",
              candidate == null && !isRequired && "ring-1 ring-inset ring-border",
              // ring (box-shadow), not outline: tailwind-merge drops `outline` next to `outline-2`.
              isRequired && "ring-2 ring-slate-500 ring-offset-2 ring-offset-white"
            )}
          />
        );
      })}
    </div>
  );
}
