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
  // Each group needs its own ids. With shared ids, clicking a label here
  // changed the first skill on the page instead of this one.
  const id = useId();

  return (
    <RadioGroup
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("flex items-center gap-3", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <div key={level} className="flex items-center gap-1">
          <RadioGroupItem value={String(level)} id={`${id}-level-${level}`} />
          <Label htmlFor={`${id}-level-${level}`} className="cursor-pointer font-normal">
            {LEVEL_LABELS[level]}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
