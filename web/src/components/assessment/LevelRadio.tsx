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
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
              isSelected
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-500 text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)] scale-[1.02]"
                : "bg-slate-50/80 border-slate-200/90 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700",
              disabled && "opacity-50 pointer-events-none"
            )}
          >
            {LEVEL_LABELS[level]}
          </button>
        );
      })}
    </div>
  );
}
