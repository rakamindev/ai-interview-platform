import { cn } from "@/lib/utils";

export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * How much the level above is worth.
 *
 * This used to render at text-xs beside a level badge set in a coloured block
 * at text-base — so the eye took the number as settled and skipped the reason
 * to doubt it. A rating and its reliability are one statement, and they are
 * given the same weight here.
 */
export function normalizeConfidence(value?: string | null): ConfidenceLevel {
  const normalized = value?.toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  // Anything absent, unrecognised, or malformed is treated as the weakest
  // claim. Guessing upward would overstate certainty about a real person.
  return "low";
}

const PRESENTATION: Record<
  ConfidenceLevel,
  { label: string; chip: string; dot: string; caveat: string | null }
> = {
  high: {
    label: "High confidence",
    chip: "border-emerald-300 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
    caveat: null,
  },
  medium: {
    label: "Medium confidence",
    chip: "border-amber-300 bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
    caveat: "Enough signal to place, not enough to settle. Worth confirming in a human interview.",
  },
  low: {
    label: "Low confidence",
    chip: "border-rose-300 bg-rose-50 text-rose-900",
    dot: "bg-rose-500",
    caveat: "Too little evidence to rate reliably. Do not use this level to screen anyone out.",
  },
};

interface ConfidenceIndicatorProps {
  confidence?: string | null;
  evidenceCount?: number;
  className?: string;
}

export default function ConfidenceIndicator({
  confidence,
  evidenceCount,
  className,
}: ConfidenceIndicatorProps) {
  const level = normalizeConfidence(confidence);
  const { label, chip, dot } = PRESENTATION[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        chip,
        className
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
      <span>{label}</span>
      {typeof evidenceCount === "number" && (
        <span className="font-normal opacity-80">
          · {evidenceCount === 1 ? "1 quote" : `${evidenceCount} quotes`}
        </span>
      )}
    </span>
  );
}

/**
 * The sentence a reader needs before they act on the level. Rendered next to
 * the rating rather than below the evidence, because the people who most need
 * it are the ones who will not scroll.
 */
export function ConfidenceCaveat({
  confidence,
  className,
}: {
  confidence?: string | null;
  className?: string;
}) {
  const level = normalizeConfidence(confidence);
  const { caveat } = PRESENTATION[level];

  if (!caveat) return null;

  return (
    <p
      className={cn(
        "text-xs leading-relaxed",
        level === "low" ? "text-rose-700" : "text-amber-700",
        className
      )}
    >
      {caveat}
    </p>
  );
}
