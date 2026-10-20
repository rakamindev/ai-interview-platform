import { LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function LevelRadio({ value, onChange, disabled, className }: LevelRadioProps) {
  return (
    <div className={cn("inline-flex flex-wrap gap-1.5", className)}>
      {[1, 2, 3, 4, 5].map((level) => {
        const isSelected = value === level;
        return (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer select-none",
              isSelected
                ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                : "bg-background text-foreground/80 border-input hover:bg-muted/50 hover:text-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="font-bold">L{level}</span>
            <span
              className={cn(
                "text-[11px]",
                isSelected ? "text-primary-foreground/90" : "text-muted-foreground"
              )}
            >
              {LEVEL_DESCRIPTIONS[level]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
