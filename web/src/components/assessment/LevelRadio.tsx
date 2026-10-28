import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
  detailed?: boolean;
}

export const LEVEL_TIERS: Record<number, { code: string; name: string; desc: string }> = {
  1: { code: "L1", name: "Beginner", desc: "Entry-level knowledge & concepts" },
  2: { code: "L2", name: "Junior", desc: "Basic hands-on under guidance" },
  3: { code: "L3", name: "Proficient", desc: "Independent execution & solid practice" },
  4: { code: "L4", name: "Advanced", desc: "Deep expertise, design & mentorship" },
  5: { code: "L5", name: "Expert", desc: "Mastery, strategy & organizational impact" },
};

export default function LevelRadio({
  value,
  onChange,
  disabled,
  className,
  detailed = true,
}: LevelRadioProps) {
  // Generate unique prefix per component instance to prevent duplicate HTML id clashes
  const instanceId = useId();

  return (
    <RadioGroup
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn(
        detailed
          ? "grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1"
          : "flex flex-wrap items-center gap-3",
        className
      )}
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const isSelected = value === level;
        const tier = LEVEL_TIERS[level];
        const radioId = `${instanceId}-lvl-${level}`;

        if (detailed) {
          return (
            <label
              key={level}
              htmlFor={radioId}
              onClick={() => {
                if (!disabled) {
                  onChange(level);
                }
              }}
              className={cn(
                "flex flex-col p-2.5 sm:p-3 rounded-xl border text-xs cursor-pointer transition-all select-none min-h-[5rem] justify-between",
                isSelected
                  ? "border-[#01959F] bg-teal-50/50 shadow-xs ring-1 ring-[#01959F]/30"
                  : "border-slate-200/90 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50/50 shadow-2xs"
              )}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className={cn("font-bold text-xs", isSelected ? "text-[#01959F]" : "text-slate-900")}>
                  {tier.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-500 font-semibold">{tier.code}</span>
                  <RadioGroupItem
                    value={String(level)}
                    id={radioId}
                    className="h-3.5 w-3.5 text-primary border-slate-300"
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-500 leading-snug">
                {tier.desc}
              </span>
            </label>
          );
        }

        return (
          <div key={level} className="flex items-center gap-1.5">
            <RadioGroupItem value={String(level)} id={radioId} />
            <Label htmlFor={radioId} className="cursor-pointer font-normal text-xs">
              <span className="font-medium text-slate-900">{tier.name}</span>{" "}
              <span className="text-muted-foreground text-[10px]">({tier.code})</span>
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
