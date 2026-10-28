import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  /** null renders the "not assessed" badge instead of a level. */
  level: number | null;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  const unrated = level == null || !LEVEL_LABELS[level];

  return (
    <div
      className={cn(
        "inline-flex shrink-0 flex-col items-center justify-center rounded-md font-semibold",
        size === "md" ? "px-3 py-2 min-w-[4.5rem] text-base" : "px-2 py-1 min-w-10 text-sm",
        unrated
          ? "border border-dashed border-neutral-300 bg-background text-muted-foreground"
          : LEVEL_BADGE_CLASSES[level],
        className
      )}
      aria-label={unrated ? "Not assessed" : `${LEVEL_LABELS[level]} ${LEVEL_DESCRIPTIONS[level]}`}
    >
      <span>{unrated ? "—" : LEVEL_LABELS[level]}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-80">
          {unrated ? "Not assessed" : LEVEL_DESCRIPTIONS[level]}
        </span>
      )}
    </div>
  );
}
