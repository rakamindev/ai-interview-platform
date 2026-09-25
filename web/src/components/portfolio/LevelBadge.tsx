import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: number | null;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded font-semibold",
        size === "md" ? "px-3 py-2 min-w-14 text-base" : "px-2 py-1 min-w-10 text-sm",
        level == null ? "bg-neutral-100 text-neutral-600" : LEVEL_BADGE_CLASSES[level],
        className
      )}
    >
      <span>{level == null ? "—" : LEVEL_LABELS[level]}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-70">{level == null ? "Not assessed" : LEVEL_DESCRIPTIONS[level]}</span>
      )}
    </div>
  );
}
