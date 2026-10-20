import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  /** Stable identifier for this group; it prefixes every generated id. */
  name: string;
  /** Accessible name for the group. */
  label: string;
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function LevelRadio({ name, label, value, onChange, disabled, className }: LevelRadioProps) {
  return (
    <RadioGroup
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      aria-label={label}
      className={cn("flex items-center gap-3", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <div key={level} className="flex items-center gap-1">
          <RadioGroupItem value={String(level)} id={`${name}-level-${level}`} />
          <Label htmlFor={`${name}-level-${level}`} className="cursor-pointer font-normal">
            {LEVEL_LABELS[level]}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
