import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
  ariaLabelledby?: string;
  ariaLabel?: string;
  namePrefix?: string;
}

export default function LevelRadio({
  value,
  onChange,
  disabled,
  className,
  ariaLabelledby,
  ariaLabel,
  namePrefix,
}: LevelRadioProps) {
  return (
    <RadioGroup
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      aria-labelledby={ariaLabelledby}
      aria-label={ariaLabel}
      className={cn("flex items-center gap-3", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const itemId = namePrefix ? `${namePrefix}-level-${level}` : `level-${level}`;
        return (
          <div key={level} className="flex items-center gap-1">
            <RadioGroupItem value={String(level)} id={itemId} />
            <Label htmlFor={itemId} className="cursor-pointer font-normal">
              {LEVEL_LABELS[level]}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
