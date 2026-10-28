import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level?: number | null;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  const isAssessed = level != null && level >= 1 && level <= 5;
  const label = isAssessed ? (LEVEL_LABELS[level] ?? `L${level}`) : "—";
  const desc = isAssessed ? (LEVEL_DESCRIPTIONS[level] ?? "") : "Unassessed";
  const badgeClass = isAssessed
    ? LEVEL_BADGE_CLASSES[level]
    : "bg-neutral-100 text-neutral-500 border border-neutral-200";

  return (
    <div
      data-testid="level-badge"
      className={cn(
        "inline-flex flex-col items-center justify-center rounded font-semibold transition-all",
        size === "md" ? "px-3 py-2 min-w-14 text-base" : "px-2 py-1 min-w-10 text-sm",
        badgeClass,
        className
      )}
    >
      <span>{label}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-75">{desc}</span>
      )}
    </div>
  );
}
