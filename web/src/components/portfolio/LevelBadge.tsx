import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  const label = LEVEL_LABELS[level] || (level === 0 ? "—" : `L${level}`);
  const desc = LEVEL_DESCRIPTIONS[level] || (level === 0 ? "Unassessed" : "");

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded font-semibold",
        size === "md" ? "px-3 py-2 min-w-14 text-base" : "px-2 py-1 min-w-10 text-sm",
        LEVEL_BADGE_CLASSES[level] || "bg-muted text-muted-foreground",
        className
      )}
    >
      <span>{label}</span>
      {size === "md" && desc && (
        <span className="text-[10px] font-normal opacity-70">{desc}</span>
      )}
    </div>
  );
}
