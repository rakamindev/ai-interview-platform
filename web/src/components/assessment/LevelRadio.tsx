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
  name?: string;
}

export default function LevelRadio({ value, onChange, disabled, className, name }: LevelRadioProps) {
  // Every card used to render id="level-3", so with N skills on a page there
  // were N elements sharing it. <Label htmlFor> binds to the first match in the
  // DOM, which meant clicking a level on the second card moved the first card's
  // radio. expected_level is the comparator in the fit/gap report, so one level
  // of silent drift moves a candidate from Match to Gap.
  const group = useId();
  return (
    <RadioGroup
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("flex items-center gap-3", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <div key={level} className="flex items-center gap-1">
          <RadioGroupItem value={String(level)} id={`${group}-level-${level}`} />
          <Label htmlFor={`${group}-level-${level}`} className="cursor-pointer font-normal">
            {LEVEL_LABELS[level]}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
