import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  /** null when nothing is selected yet (e.g. rating a skill the AI could not assess). */
  value: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export default function LevelRadio({ value, onChange, disabled, className, "aria-label": ariaLabel }: LevelRadioProps) {
  // Unique per instance: several radios share a page (one per skill card or override panel).
  const idPrefix = useId();

  return (
    <RadioGroup
      value={value == null ? "" : String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-3", className)}
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
