import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

type Confidence = "high" | "medium" | "low";

type ResultType = "match" | "gap" | "exceed" | "insufficient_evidence" | "not_assessed";

interface AnchorRailProps {
  skillLabel: string;
  requiredLevel: number;
  candidateLevel?: number;
  confidence?: Confidence;
  result?: ResultType;
  isOverride?: boolean;
  compact?: boolean;
  className?: string;
}

const LEVELS = [1, 2, 3, 4, 5] as const;

const CONFIDENCE_SIZE: Record<Confidence, string> = {
  high: "w-3 h-3",
  medium: "w-4 h-4",
  low: "w-6 h-6"
};

const CONFIDENCE_OPACITY: Record<Confidence, string> = {
  high: "opacity-100",
  medium: "opacity-75",
  low: "opacity-50"
};

function verdictColor(level: number, required: number): string {
  if (level > required) return "bg-verdict-exceed";
  if (level === required) return "bg-verdict-match";
  return "bg-verdict-gap";
}

function positionPercent(level: number): number {
  return ((level - 1) / 4) * 100;
}

function ariaDescription(
  skillLabel: string,
  requiredLevel: number,
  candidateLevel: number | undefined,
  confidence: Confidence,
  compact: boolean
): string {
  if (candidateLevel == null) {
    return compact
      ? `Requirement L${requiredLevel}. Not assessed.`
      : `${skillLabel}: ${m.fitgap_not_assessed()}. Requirement at L${requiredLevel}.`;
  }
  const diff = candidateLevel - requiredLevel;
  let relation: string;
  if (diff === 0) relation = m.fitgap_meets();
  else if (diff > 0) relation = `${m.fitgap_exceeds_by()} ${diff}`;
  else relation = `${Math.abs(diff)} ${m.fitgap_below()}`;
  const confidenceNote =
    confidence === "high"
      ? ""
      : confidence === "medium"
        ? m.fitgap_moderate_confidence()
        : m.fitgap_low_confidence_aria();
  if (compact) {
    return `Requirement L${requiredLevel}. Candidate L${candidateLevel} ${relation}${confidenceNote}.`;
  }
  return `${skillLabel}: candidate L${candidateLevel} ${relation} requirement L${requiredLevel}${confidenceNote}.`;
}

export default function AnchorRail({
  skillLabel,
  requiredLevel,
  candidateLevel,
  confidence = "high",
  result,
  isOverride,
  compact = false,
  className
}: AnchorRailProps) {
  const hasCandidate = candidateLevel != null;
  const reqPct = positionPercent(requiredLevel);

  return (
    <div
      className={cn(compact ? "flex items-center gap-1" : "flex flex-col gap-1.5", className)}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={ariaDescription(skillLabel, requiredLevel, candidateLevel, confidence, compact)}
    >
      {/* Skill label — hidden in compact mode */}
      {!compact && <span className="text-sm font-medium truncate">{skillLabel}</span>}

      {/* Rail */}
      <div className="relative h-5 bg-rail-track rounded-sm">
        {/* Level tick labels — hidden in compact mode */}
        {!compact &&
          LEVELS.map((lvl) => (
            <span
              key={lvl}
              className="absolute top-full mt-0.5 text-[10px] text-muted-foreground -translate-x-1/2 select-none"
              style={{ left: `${positionPercent(lvl)}%` }}
            >
              L{lvl}
            </span>
          ))}

        {/* Requirement mark — triangle always visible */}
        {hasCandidate && candidateLevel === requiredLevel ? (
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-mark-requirement z-10"
            style={{ left: `${reqPct}%` }}
          />
        ) : (
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-mark-requirement"
            style={{ left: `${reqPct}%` }}
          />
        )}

        {/* Candidate mark or uncertainty band */}
        {hasCandidate && (
          <>
            {/* Uncertainty band — shown when confidence is not high */}
            {confidence !== "high" && (
              <span
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2 rounded-full",
                  verdictColor(candidateLevel, requiredLevel),
                  CONFIDENCE_OPACITY[confidence]
                )}
                style={{
                  left: `${positionPercent(candidateLevel)}%`,
                  width: confidence === "medium" ? "2rem" : "3.5rem"
                }}
              />
            )}

            {/* Filled dot — always present, varying size by confidence */}
            <span
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full",
                CONFIDENCE_SIZE[confidence],
                verdictColor(candidateLevel, requiredLevel),
                confidence === "high" ? "opacity-100" : "opacity-75",
                result === "insufficient_evidence" && "ring-2 ring-dashed ring-verdict-unknown"
              )}
              style={{ left: `${positionPercent(candidateLevel)}%` }}
            />
          </>
        )}
      </div>

      {/* not_assessed dash label */}
      {compact && !hasCandidate && <span className="text-xs text-muted-foreground">—</span>}

      {/* Override indicator */}
      {compact && isOverride && (
        <span
          className="inline-flex items-center text-[10px] text-muted-foreground"
          data-override
          aria-label="override applied"
        >
          ✎
        </span>
      )}
    </div>
  );
}
