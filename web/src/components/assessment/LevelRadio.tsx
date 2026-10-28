
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

export default function LevelRadio({
  value,
  onChange,
  disabled,
  className,
}: LevelRadioProps) {
  return (
    <RadioGroup
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2",
        className,
      )}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <div
          key={level}
          className="flex min-w-0 items-center gap-1.5"
        >
          <RadioGroupItem
            value={String(level)}
            id={`level-${level}`}
            className="shrink-0"
          />
          <Label
            htmlFor={`level-${level}`}
            className="cursor-pointer break-words text-sm font-normal"
          >
            {LEVEL_LABELS[level]}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
