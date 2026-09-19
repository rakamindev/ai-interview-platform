import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
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
        "inline-flex shrink-0 flex-col items-center justify-center rounded-md bg-brand-soft font-display font-semibold text-brand-deep",
        size === "md" ? "min-w-14 px-3 py-2 text-base" : "h-[22px] min-w-8 px-2 text-[11.5px]",
        className
      )}
    >
      <span>{LEVEL_LABELS[level]}</span>
      {size === "md" && (
        <span className="font-sans text-[10px] font-normal opacity-70">
          {LEVEL_DESCRIPTIONS[level]}
        </span>
      )}
    </div>
  );
}
