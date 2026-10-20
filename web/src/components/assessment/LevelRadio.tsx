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
  ariaLabel?: string;
}

export default function LevelRadio({
  value,
  onChange,
  disabled,
  className,
  ariaLabel = "Skill proficiency level",
}: LevelRadioProps) {
  const instanceId = useId();

  return (
    <RadioGroup
      aria-label={ariaLabel}
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("grid grid-cols-2 sm:grid-cols-5 gap-2", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const itemId = `${instanceId}-level-${level}`;
        const isSelected = value === level;
        return (
          <div
            key={level}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2.5 py-2 transition-colors",
              isSelected
                ? "border-[#0F8F95] bg-[#0F8F95]/[0.06] text-[#1F2937] shadow-2xs"
                : "border-[#E2E8F0] bg-white hover:border-slate-300 text-[#64748B]",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <RadioGroupItem value={String(level)} id={itemId} className="shrink-0" />
            <Label
              htmlFor={itemId}
              className={cn(
                "cursor-pointer flex flex-col leading-tight min-w-0 flex-1",
                disabled && "cursor-not-allowed"
              )}
            >
              <span className="text-xs font-semibold text-[#1F2937]">
                {LEVEL_LABELS[level]}
              </span>
              <span className="text-[11px] text-[#64748B] truncate">
                {LEVEL_DESCRIPTIONS[level]}
              </span>
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

