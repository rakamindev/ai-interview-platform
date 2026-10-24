import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: number | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  if (level === null || level === undefined) {
    return (
      <div
        data-testid="unassessed-badge"
        className={cn(
          "inline-flex flex-col items-center justify-center rounded font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/80 shadow-xs",
          size === "md" ? "px-2.5 py-1.5 min-w-14 text-xs" : "px-2 py-0.5 min-w-10 text-[11px]",
          className
        )}
      >
        <span className="font-semibold text-neutral-700">N/A</span>
        {size === "md" && (
          <span className="text-[9px] font-normal text-neutral-500 uppercase tracking-wider">Unassessed</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded font-semibold shadow-xs transition-colors",
        size === "md" ? "px-3 py-2 min-w-14 text-base" : "px-2 py-1 min-w-10 text-sm",
        LEVEL_BADGE_CLASSES[level] || "bg-neutral-100 text-neutral-700",
        className
      )}
    >
      <span>{LEVEL_LABELS[level] ?? `L${level}`}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-70">
          {LEVEL_DESCRIPTIONS[level] ?? "Competency"}
        </span>
      )}
    </div>
  );
}
