import { cn } from "@/lib/utils";

const LEVELS = [1, 2, 3, 4, 5] as const;

export interface LevelScaleProps {
  required?: number | null;
  candidate: number | null;
  className?: string;
}

// L1 to L5 drawn without relying on colour: squares are filled up to the
// candidate level (hollow when not assessed) and a bar above marks the
// required level, when there is one. Screen readers get the same
// information as one sentence.
export function LevelScale({ required, candidate, className }: LevelScaleProps) {
  const level = candidate ? `L${candidate}` : "not assessed";
  const label = required ? `Required L${required}, candidate ${level}` : candidate ? `Level ${level}` : "Not assessed";

  return (
    <div role="img" aria-label={label} className={cn("inline-flex items-end gap-1", className)}>
      {LEVELS.map((level) => {
        const filled = candidate != null && level <= candidate;
        const isRequired = level === required;
        return (
          <span
            key={level}
            data-level-step={level}
            data-filled={String(filled)}
            data-required={isRequired ? "" : undefined}
            className="flex flex-col items-center gap-0.5"
          >
            <span className={cn("h-1 w-3 rounded-full", isRequired ? "bg-foreground" : "bg-transparent")} />
            <span
              className={cn(
                "h-3 w-3 rounded-sm border",
                filled ? "border-primary bg-primary" : "border-slate-500 bg-background",
              )}
            />
          </span>
        );
      })}
    </div>
  );
}
