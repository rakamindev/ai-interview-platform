import { LEVEL_LABELS, LEVEL_BADGE_SOLID, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  const solidColor = LEVEL_BADGE_SOLID[level] || "bg-slate-500 text-white";

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center font-bold select-none shrink-0",
        size === "md" ? "min-w-[74px] px-2 h-14 text-base" : "px-2 py-0.5 min-w-8 text-xs",
        solidColor,
        className
      )}
    >
      <span className="leading-tight text-lg">{LEVEL_LABELS[level] || `L${level}`}</span>
      {size === "md" && (
        <span className="text-[8px] uppercase tracking-normal font-semibold opacity-90 leading-none mt-1 text-center">
          {LEVEL_DESCRIPTIONS[level]}
        </span>
      )}
    </div>
  );
}
