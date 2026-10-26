import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
  /** Custom label function; defaults to L1–L5 */
  labelFn?: (level: number) => string;
  /** Optional one-line description under each option (vacancy forms only) */
  descriptionFn?: (level: number) => string;
}

const defaultLabel = (level: number) => `L${level}`;

export default function LevelRadio({ value, onChange, disabled, className, labelFn = defaultLabel, descriptionFn }: LevelRadioProps) {
  return (
    <RadioGroup
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className={cn("flex items-center gap-3", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <div key={level} className="flex items-start gap-1">
          <RadioGroupItem value={String(level)} id={`level-${level}`} />
          <div className="flex flex-col">
            <Label htmlFor={`level-${level}`} className="cursor-pointer font-normal">
              {labelFn(level)}
            </Label>
            {descriptionFn && (
              <span className="text-xs text-muted-foreground">{descriptionFn(level)}</span>
            )}
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}
