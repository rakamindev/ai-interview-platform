import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  /** null when the interview produced no assessable evidence for this skill. */
  level: number | null;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  // An unrated skill gets its own visual treatment rather than borrowing L1's.
  // Dashed and grey reads as "nothing here", where a solid badge reads as a
  // finding — which is precisely the confusion that made unassessed skills
  // look like weak ones.
  if (level == null) {
    return (
      <div
        className={cn(
          "inline-flex flex-col items-center justify-center rounded border border-dashed",
          "border-neutral-300 bg-neutral-50 font-semibold text-neutral-400",
          size === "md" ? "min-w-14 px-3 py-2 text-base" : "min-w-10 px-2 py-1 text-sm",
          className
        )}
        title="Not assessed — the interview produced no evidence for this skill"
      >
        <span aria-hidden>—</span>
        <span className="sr-only">Not assessed</span>
        {size === "md" && (
          <span className="text-[10px] font-normal opacity-80">Not rated</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded font-semibold",
        size === "md" ? "min-w-14 px-3 py-2 text-base" : "min-w-10 px-2 py-1 text-sm",
        LEVEL_BADGE_CLASSES[level],
        className
      )}
    >
      <span>{LEVEL_LABELS[level] ?? `L${level}`}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-70">{LEVEL_DESCRIPTIONS[level]}</span>
      )}
    </div>
  );
}
