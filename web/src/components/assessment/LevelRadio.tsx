import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  /** null renders with nothing selected — used when no level has been assigned yet. */
  value: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function LevelRadio({ value, onChange, disabled, className }: LevelRadioProps) {
  // Ids were previously hardcoded as `level-1`..`level-5`. The portfolio page
  // renders one of these per skill, so the document ended up with five ids
  // repeated N times: clicking a label could activate a radio belonging to a
  // different skill, and screen readers had no way to resolve the reference.
  const groupId = useId();

  return (
    <RadioGroup
      value={value == null ? "" : String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("flex items-center gap-3", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const itemId = `${groupId}-level-${level}`;
        return (
          <div key={level} className="flex items-center gap-1">
            <RadioGroupItem value={String(level)} id={itemId} />
            <Label
              htmlFor={itemId}
              className="cursor-pointer font-normal"
              title={LEVEL_DESCRIPTIONS[level]}
            >
              {LEVEL_LABELS[level]}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
