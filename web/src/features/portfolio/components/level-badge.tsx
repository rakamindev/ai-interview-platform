import { cn } from "@/lib/utils";
import { LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS, LEVEL_LABELS } from "@/utils/constants";

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md";
  className?: string;
}

export function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded font-semibold",
        size === "md" ? "min-w-14 px-3 py-2 text-base" : "min-w-6 px-2 py-1 text-sm",
        LEVEL_BADGE_CLASSES[level] ?? LEVEL_BADGE_CLASSES[1],
        className
      )}
    >
      <span>{LEVEL_LABELS[level] ?? LEVEL_LABELS[1]}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-70">{LEVEL_DESCRIPTIONS[level]}</span>
      )}
    </div>
  );
}
