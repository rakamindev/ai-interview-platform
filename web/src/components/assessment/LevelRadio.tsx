import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function LevelRadio({ value, onChange, disabled, className }: LevelRadioProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {[1, 2, 3, 4, 5].map((level) => {
        const isSelected = value === level;
        return (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 shadow-2xs",
              isSelected
                ? "bg-primary text-white border-primary shadow-xs ring-2 ring-primary/20"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            )}
          >
            <span>{LEVEL_LABELS[level]}</span>
            <span className={cn("text-[10px] font-normal", isSelected ? "text-primary-foreground/90" : "text-slate-400")}>
              {LEVEL_DESCRIPTIONS[level]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
