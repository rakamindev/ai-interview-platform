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
              "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border text-left flex items-center gap-1.5",
              isSelected
                ? "bg-teal-600 text-white border-teal-600 shadow-xs scale-[1.02]"
                : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className={cn(
              "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-mono",
              isSelected ? "bg-white text-teal-700" : "bg-slate-100 text-slate-600"
            )}>
              {level}
            </span>
            <span>{LEVEL_LABELS[level]}</span>
          </button>
        );
      })}
    </div>
  );
}
