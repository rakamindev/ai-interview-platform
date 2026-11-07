import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function LevelRadio({ value, onChange, disabled, className }: LevelRadioProps) {
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {[1, 2, 3, 4, 5].map((level) => {
        const isSelected = value === level;
        return (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 border",
              isSelected
                ? "bg-teal-700 text-white border-teal-700 shadow-sm"
                : "bg-background text-muted-foreground border-input hover:bg-muted hover:text-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {LEVEL_LABELS[level] || `L${level}`}
          </button>
        );
      })}
    </div>
  );
}