import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 flex-col items-center justify-center rounded font-semibold",
        size === "md" ? "h-20 w-20 px-2 py-2 text-lg" : "h-8 min-w-10 px-2 text-sm",
        LEVEL_BADGE_CLASSES[level],
        className
      )}
    >
      <span>{LEVEL_LABELS[level]}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-70">{LEVEL_DESCRIPTIONS[level]}</span>
      )}
    </div>
  );
}
