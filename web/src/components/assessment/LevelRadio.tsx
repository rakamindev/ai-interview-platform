import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
  name?: string;
}

export default function LevelRadio({ value, onChange, disabled, className, name }: LevelRadioProps) {
  const generatedId = useId();
  const baseId = name || generatedId;

  return (
    <RadioGroup
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("grid grid-cols-2 sm:grid-cols-5 gap-2 w-full", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const isSelected = value === level;
        const inputId = `${baseId}-level-${level}`;

        return (
          <Label
            key={level}
            htmlFor={inputId}
            className={cn(
              "relative flex flex-col items-center justify-center p-2 sm:py-2.5 rounded-xl border cursor-pointer transition-all duration-150 select-none text-center",
              isSelected
                ? "bg-teal-50/90 border-[#01959f] text-slate-900 shadow-xs ring-1 ring-[#01959f]/30"
                : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70 text-slate-700",
              disabled && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <RadioGroupItem
                value={String(level)}
                id={inputId}
                className={cn(
                  "h-3.5 w-3.5 border-slate-300 text-[#01959f] focus:ring-[#01959f] shrink-0",
                  isSelected && "border-[#01959f]"
                )}
              />
              <span
                className={cn(
                  "text-xs font-black tracking-tight",
                  isSelected ? "text-[#01959f]" : "text-slate-900"
                )}
              >
                {LEVEL_LABELS[level]}
              </span>
            </div>
            <span
              className={cn(
                "text-[10px] sm:text-[11px] font-medium leading-tight",
                isSelected ? "text-teal-900 font-semibold" : "text-slate-500"
              )}
            >
              {LEVEL_DESCRIPTIONS[level]}
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
