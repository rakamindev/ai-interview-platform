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
}

export default function LevelRadio({ value, onChange, disabled, className }: LevelRadioProps) {
  const groupId = useId();
  return (
    <RadioGroup
      aria-label="Expected skill level"
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <div key={level} className="flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-muted/60">
          <RadioGroupItem value={String(level)} id={`${groupId}-level-${level}`} />
          <Label htmlFor={`${groupId}-level-${level}`} className="cursor-pointer font-normal">
            {LEVEL_LABELS[level]}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
