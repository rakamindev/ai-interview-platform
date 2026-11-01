import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function LevelRadio({ value, onChange, disabled, className }: LevelRadioProps) {
  // Several radios render on one page (one per skill); ids must not collide or a label
  // click selects the level in the first group instead of its own.
  const idPrefix = useId();

  return (
    <RadioGroup
      value={value === null ? "" : String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <div
          key={level}
          className="flex items-center gap-1.5 rounded-full border bg-card py-1 pl-2 pr-3 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-rakamin-light-cyan"
        >
          <RadioGroupItem value={String(level)} id={`${idPrefix}-level-${level}`} />
          <Label htmlFor={`${idPrefix}-level-${level}`} className="cursor-pointer font-normal">
            {LEVEL_LABELS[level]}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
