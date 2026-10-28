import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  /** null: nothing selected yet. */
  value: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
  "aria-labelledby"?: string;
}

export default function LevelRadio({ value, onChange, disabled, className, ...aria }: LevelRadioProps) {
  // Unique per instance: several of these can be on one page.
  const idPrefix = useId();

  return (
    <RadioGroup
      value={value == null ? "" : String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("flex flex-wrap items-center gap-3", className)}
      {...aria}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <div key={level} className="flex items-center gap-1">
          <RadioGroupItem value={String(level)} id={`${idPrefix}-level-${level}`} />
          <Label htmlFor={`${idPrefix}-level-${level}`} className="cursor-pointer font-normal">
            {LEVEL_LABELS[level]}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
