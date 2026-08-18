import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value?: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function LevelRadio({ value, onChange, disabled, className }: LevelRadioProps) {
  const radioGroupId = React.useId();
  const safeValue = value != null && value >= 1 && value <= 5 ? String(value) : "3";

  return (
    <RadioGroup
      value={safeValue}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("flex items-center gap-3", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const itemId = `${radioGroupId}-level-${level}`;
        return (
          <div key={level} className="flex items-center gap-1">
            <RadioGroupItem value={String(level)} id={itemId} />
            <Label htmlFor={itemId} className="cursor-pointer font-normal text-xs">
              {LEVEL_LABELS[level] ?? `L${level}`}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
