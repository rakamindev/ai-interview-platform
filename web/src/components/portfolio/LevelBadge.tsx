import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  // null = no valid rating; rendered as unrated rather than a guessed level.
  level: number | null;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  const rated = level !== null;

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-xl font-semibold",
        size === "md" ? "px-3 py-2 min-w-14 text-base" : "px-2 py-1 min-w-10 text-sm",
        rated ? LEVEL_BADGE_CLASSES[level] : "border border-dashed text-muted-foreground",
        className,
      )}
    >
      <span>{rated ? LEVEL_LABELS[level] : "—"}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-70">
          {rated ? LEVEL_DESCRIPTIONS[level] : "Unrated"}
        </span>
      )}
    </div>
  );
}
