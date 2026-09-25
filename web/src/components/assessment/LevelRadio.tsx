import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  value: number;
  onChange: (level: number) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
}

export default function LevelRadio({
  value,
  onChange,
  disabled,
  className,
}: LevelRadioProps) {
  const currentVal = Number(value) || 3;

  return (
    <>
      {/* Desktop view (sm:flex): Standard Radio Buttons with labels exactly as before */}
      <RadioGroup
        value={String(currentVal)}
        onValueChange={(v) => onChange(Number(v))}
        disabled={disabled}
        className={cn("hidden sm:flex items-center gap-3", className)}
      >
        {[1, 2, 3, 4, 5].map((level) => (
          <div key={level} className="flex items-center gap-1">
            <RadioGroupItem value={String(level)} id={`level-desktop-${level}`} />
            <Label
              htmlFor={`level-desktop-${level}`}
              className="cursor-pointer font-normal text-xs text-foreground"
            >
              {LEVEL_LABELS[level]}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {/* Mobile view (< sm): Compact Segmented Control so it never overflows left border */}
      <div
        role="radiogroup"
        aria-label="Competency Level"
        className={cn(
          "flex sm:hidden items-center p-0.5 rounded-lg bg-muted/80 border border-border/70 select-none shrink-0",
          className
        )}
      >
        {[1, 2, 3, 4, 5].map((level) => {
          const isSelected = currentVal === level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(level)}
              className={cn(
                "font-semibold rounded-md transition-all cursor-pointer px-2 py-0.5 text-[11px]",
                isSelected
                  ? "bg-[#01959F] text-white shadow-xs font-bold ring-1 ring-[#01959F]/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/80"
              )}
            >
              L{level}
            </button>
          );
        })}
      </div>
    </>
  );
}
