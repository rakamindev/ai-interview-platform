import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/fitGap";

const LEVELS = [1, 2, 3, 4, 5];

const FILL: Record<Tone, string> = {
  negative: "bg-rose-500",
  attention: "border border-dashed border-amber-500 bg-amber-100",
  neutral: "bg-muted",
  positive: "bg-emerald-500",
};

interface LevelScaleProps {
  expected: number;
  /** The level shown on the scale: confirmed, or the unconfirmed AI level. */
  level: number | null;
  tone: Tone;
  label: string;
}

/**
 * Five-step L1–L5 scale. Filled steps are the candidate's level (dashed when
 * unconfirmed); the outlined step is what the role expects.
 */
export default function LevelScale({ expected, level, tone, label }: LevelScaleProps) {
  return (
    <div role="img" aria-label={label} className="flex w-full max-w-[220px] items-center gap-1">
      {LEVELS.map((step) => {
        const filled = level != null && step <= level;
        return (
          <span
            key={step}
            className={cn(
              "h-2.5 flex-1 rounded-sm",
              filled ? FILL[tone] : "bg-muted",
              step === expected && "ring-2 ring-foreground/70 ring-offset-1 ring-offset-background",
            )}
          />
        );
      })}
    </div>
  );
}
