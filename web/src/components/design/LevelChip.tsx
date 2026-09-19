import { cn } from "@/lib/utils";
import { LEVEL_LABELS } from "@/utils/constants";

interface LevelChipProps {
  level: number | string;
  plain?: boolean;
  className?: string;
}

export default function LevelChip({ level, plain, className }: LevelChipProps) {
  const label =
    typeof level === "number" ? LEVEL_LABELS[level] ?? `L${level}` : level;

  return (
    <span
      className={cn(
        "inline-flex h-[22px] min-w-8 items-center justify-center rounded-md px-2 font-display text-[11.5px] font-semibold",
        plain ? "bg-surface-alt text-muted-foreground" : "bg-brand-soft text-brand-deep",
        className
      )}
    >
      {label}
    </span>
  );
}
