import { LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS, isLevel, levelLabel } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  /** null renders the "not assessed" state, never a level. */
  level: number | null;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  const assessed = isLevel(level);

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-md font-semibold tabular-nums",
        size === "md" ? "w-24 shrink-0 px-2 py-2 text-base" : "min-w-10 px-2 py-1 text-sm",
        assessed
          ? LEVEL_BADGE_CLASSES[level]
          : "border border-dashed border-unassessed bg-transparent text-muted-foreground",
        className,
      )}
    >
      <span className={cn(!assessed && size === "md" && "text-sm")}>{assessed ? levelLabel(level) : "—"}</span>
      {size === "md" && (
        <span className="text-[11px] font-normal opacity-80">
          {assessed ? LEVEL_DESCRIPTIONS[level] : "Not assessed"}
        </span>
      )}
      {size === "sm" && !assessed && <span className="sr-only">Not assessed</span>}
    </div>
  );
}
