import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  const isZero = level === 0;
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded font-semibold text-center",
        size === "md"
          ? (isZero ? "px-2 py-1.5 min-w-16 text-xs" : "px-3 py-2 min-w-14 text-base")
          : (isZero ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 min-w-10 text-sm"),
        LEVEL_BADGE_CLASSES[level] ?? LEVEL_BADGE_CLASSES[0],
        className
      )}
    >
      <span>{LEVEL_LABELS[level] ?? "Unassessed"}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-80">{LEVEL_DESCRIPTIONS[level] ?? "Not evaluated"}</span>
      )}
    </div>
  );
}
