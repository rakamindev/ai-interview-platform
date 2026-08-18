import { cn } from "@/lib/utils";

const LEVELS = [1, 2, 3, 4, 5];

export interface LevelTrackProps {
  /** The level the candidate reached. Null means no measurement was taken. */
  reached?: number | null;
  /** The level the role requires. Omit on screens that only show a rating. */
  required?: number | null;
  /** Drives the fill colour once a comparison has a verdict. */
  tone?: "neutral" | "exceed" | "match" | "gap";
  size?: "sm" | "md";
  className?: string;
}

const TONE_FILL: Record<string, string> = {
  neutral: "bg-primary border-primary",
  exceed: "bg-result-exceed border-result-exceed",
  match: "bg-result-match border-result-match",
  gap: "bg-result-gap border-result-gap",
};

/**
 * The one instrument this product uses to show a level.
 *
 * Everything here is measured on the same five-point scale, so it is drawn the
 * same way everywhere: five segments, filled up to the level reached. In a
 * comparison the segment the role requires carries a marker, which turns the
 * shortfall into a visible distance instead of arithmetic the reader has to do.
 *
 * A skill that was never assessed is drawn dashed and empty. That is a
 * different statement from a low rating — no reading was taken — and conflating
 * the two is what makes reviewers reject candidates the interview never asked
 * about.
 */
export default function LevelTrack({
  reached,
  required,
  tone = "neutral",
  size = "md",
  className,
}: LevelTrackProps) {
  const hasReading = typeof reached === "number" && reached > 0;
  const segment = size === "sm" ? "h-2 w-5" : "h-2.5 w-7";

  const label = hasReading
    ? required
      ? `Level ${reached} of 5, role requires level ${required}`
      : `Level ${reached} of 5`
    : "Not assessed";

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="img"
      aria-label={label}
    >
      {LEVELS.map((level) => {
        const filled = hasReading && level <= (reached as number);
        const isRequired = typeof required === "number" && level === required;

        return (
          <span key={level} className="relative inline-flex">
            <span
              className={cn(
                "rounded-[2px] border transition-colors",
                segment,
                filled
                  ? TONE_FILL[tone]
                  : hasReading
                  ? "border-border bg-muted"
                  : "border-dashed border-result-none/50 bg-transparent",
              )}
            />
            {isRequired && (
              /* The requirement rides on the track rather than sitting in its own
                 column, so "how far short" is read as distance, not subtraction. */
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -inset-x-0.5 -inset-y-1 rounded-[3px]",
                  "border-2 border-foreground",
                )}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
