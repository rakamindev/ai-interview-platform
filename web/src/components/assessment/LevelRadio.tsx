import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
  // Accessible name of the group, e.g. "Expected level for Ruby on Rails".
  label?: string;
}

// Ids are unique per instance: with fixed ids (level-1..5) a label in one
// skill selected the radio of the first skill on the page.
export default function LevelRadio({ value, onChange, disabled, className, label }: LevelRadioProps) {
  const id = useId();
  return (
    <RadioGroup
      aria-label={label}
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("flex items-center gap-3 max-sm:gap-1", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <div key={level} className="flex max-sm:min-h-11 max-sm:min-w-11 items-center gap-1">
          <RadioGroupItem value={String(level)} id={`${id}-level-${level}`} />
          <Label htmlFor={`${id}-level-${level}`} className="cursor-pointer font-normal max-sm:flex max-sm:flex-1 max-sm:self-stretch max-sm:items-center">
            {LEVEL_LABELS[level]}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
