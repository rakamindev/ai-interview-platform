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
        "inline-flex items-center gap-1.5 rounded-md font-semibold border shrink-0",
        size === "md"
          ? "px-2.5 py-1 text-xs"
          : "px-2 py-0.5 text-xs",
        LEVEL_BADGE_CLASSES[level] ?? "bg-slate-100 text-slate-700 border-slate-200",
        className
      )}
    >
      <span className="leading-none">{LEVEL_LABELS[level]}</span>
      {size === "md" && LEVEL_DESCRIPTIONS[level] && (
        <>
          <span className="opacity-40" aria-hidden="true">·</span>
          <span className="font-medium opacity-90 leading-none">
            {LEVEL_DESCRIPTIONS[level]}
          </span>
        </>
      )}
    </div>
  );
}

