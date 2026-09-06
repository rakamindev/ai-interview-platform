import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { ConfidenceLevel, SkillComparison } from "@/types";

/**
 * The last artifact a human reads before deciding on a candidate.
 *
 * Its job is not to state a verdict but to let a reader weigh one. Every level
 * on this screen is a model's inference from a conversation, and the amount of
 * evidence behind those inferences varies enormously — from five probes and
 * three quotes down to a single passing remark. The engine computes that
 * difference; this table's responsibility is to keep it visible.
 */

const CONFIDENCE_STYLE: Record<ConfidenceLevel, { chip: string; label: string }> = {
  high: { chip: "text-emerald-700 bg-emerald-50 ring-emerald-600/20", label: "High" },
  medium: { chip: "text-amber-700 bg-amber-50 ring-amber-600/20", label: "Medium" },
  low: { chip: "text-rose-700 bg-rose-50 ring-rose-600/20", label: "Low" },
};

/** Shared by every body cell so one class list drives the mobile card layout. */
const CELL =
  "px-4 py-3 align-middle " +
  "max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-4 " +
  "max-sm:px-4 max-sm:py-1.5 " +
  "max-sm:before:content-[attr(data-label)] max-sm:before:text-xs " +
  "max-sm:before:font-medium max-sm:before:uppercase max-sm:before:tracking-wide " +
  "max-sm:before:text-muted-foreground max-sm:before:shrink-0";

function LevelChip({ level, muted = false }: { level: number; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.25rem] justify-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        muted ? "text-muted-foreground bg-muted" : "text-foreground bg-muted",
      )}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const { result, delta } = comparison;
  const label = FIT_GAP_RESULT_LABELS[result];

  let icon = "—";
  let suffix = "";
  if (result === "match") icon = "✅";
  else if (result === "exceed") {
    icon = "⭐";
    suffix = delta != null ? ` +${delta}` : "";
  } else if (result === "gap") {
    icon = "⚠";
    suffix = delta != null ? ` −${Math.abs(delta)}` : "";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium",
        FIT_GAP_RESULT_CLASSES[result],
      )}
    >
      {icon} {label}
      {suffix}
    </span>
  );
}

/**
 * Renders what stands behind a rating. An unassessed requirement deliberately
 * reads as "never asked" rather than as an empty cell: absence of evidence is
 * not evidence of absence, and the difference decides whether a recruiter
 * schedules another conversation or rejects the candidate.
 */
function EvidenceCell({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result === "not_assessed") {
    return <span className="text-xs text-muted-foreground">Never probed</span>;
  }

  const confidence = comparison.confidence ? CONFIDENCE_STYLE[comparison.confidence] : null;
  const quotes = comparison.evidence_count;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {confidence && (
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
            confidence.chip,
          )}
          title={`Model confidence: ${confidence.label.toLowerCase()}`}
        >
          {confidence.label}
        </span>
      )}
      <span
        className={cn("text-xs tabular-nums", quotes === 0 ? "text-rose-600" : "text-muted-foreground")}
        title={
          quotes === 0
            ? "No verbatim quote supports this rating"
            : `${quotes} verbatim ${quotes === 1 ? "quote" : "quotes"} support this rating`
        }
      >
        {quotes} {quotes === 1 ? "quote" : "quotes"}
      </span>
    </span>
  );
}

function CandidateCell({ comparison }: { comparison: SkillComparison }) {
  const { candidate_level, ai_level, is_override, result } = comparison;

  if (candidate_level == null) {
    return (
      <span className="text-sm text-muted-foreground" aria-label="No level assigned">
        —
      </span>
    );
  }

  const showsCorrection = is_override && ai_level != null && ai_level !== candidate_level;

  return (
    <span className="inline-flex items-center gap-1.5">
      {showsCorrection && (
        <>
          <span className="text-xs text-muted-foreground line-through tabular-nums">{LEVEL_LABELS[ai_level]}</span>
          <span aria-hidden className="text-xs text-muted-foreground">
            →
          </span>
        </>
      )}
      <LevelChip level={candidate_level} muted={result === "not_assessed"} />
      {is_override && (
        <span
          className="text-xs text-sky-600"
          title="Assessor override applied — this level was corrected by a human"
          aria-label="Assessor override applied"
        >
          ✏
        </span>
      )}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: { comparisons: SkillComparison[] }) {
  if (comparisons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-10 text-center">
        <p className="text-sm font-medium">No skills to compare</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          This vacancy has no required skills defined yet. Add expected levels to the vacancy to compare it against
          this portfolio.
        </p>
      </div>
    );
  }

  const count = (result: SkillComparison["result"]) => comparisons.filter((c) => c.result === result).length;
  const matchCount = count("match");
  const gapCount = count("gap");
  const exceedCount = count("exceed");
  const notAssessedCount = count("not_assessed");
  const thinlyEvidenced = comparisons.filter((c) => c.result !== "not_assessed" && c.confidence === "low").length;
  const overrideCount = comparisons.filter((c) => c.is_override).length;

  const plural = (n: number) => (n === 1 ? "skill" : "skills");

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border max-sm:border-0">
        <table className="w-full text-sm max-sm:block">
          <thead className="max-sm:hidden">
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium">Skill</th>
              <th className="px-4 py-2.5 text-center font-medium">Required</th>
              <th className="px-4 py-2.5 text-center font-medium">Candidate</th>
              <th className="px-4 py-2.5 text-left font-medium">Evidence</th>
              <th className="px-4 py-2.5 text-center font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="max-sm:block max-sm:space-y-2">
            {comparisons.map((c, i) => (
              <tr
                key={c.skill_id ?? `${c.skill_label}-${i}`}
                className={cn(
                  "border-b last:border-0",
                  "max-sm:block max-sm:rounded-lg max-sm:border max-sm:py-2",
                  c.result === "not_assessed" && "bg-muted/20 max-sm:border-dashed",
                )}
              >
                <td
                  data-label="Skill"
                  className={cn(CELL, "font-medium max-sm:before:hidden max-sm:justify-start")}
                >
                  <span className="break-words">{c.skill_label}</span>
                </td>
                <td data-label="Required" className={cn(CELL, "text-center max-sm:text-right")}>
                  <LevelChip level={c.expected_level} />
                </td>
                <td data-label="Candidate" className={cn(CELL, "text-center max-sm:text-right")}>
                  <CandidateCell comparison={c} />
                </td>
                <td data-label="Evidence" className={cn(CELL, "text-left max-sm:text-right")}>
                  <EvidenceCell comparison={c} />
                </td>
                <td data-label="Result" className={cn(CELL, "text-center max-sm:text-right")}>
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary. Unassessed requirements are counted here on purpose: they are
          the easiest thing to scroll past and the most consequential to miss. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span>
            ✅ Match: {matchCount} {plural(matchCount)}
          </span>
        )}
        {exceedCount > 0 && (
          <span>
            ⭐ Exceeds: {exceedCount} {plural(exceedCount)}
          </span>
        )}
        {gapCount > 0 && (
          <span>
            ⚠ Gap: {gapCount} {plural(gapCount)}
          </span>
        )}
        {notAssessedCount > 0 && (
          <span className="font-medium text-foreground">
            — {notAssessedCount} {plural(notAssessedCount)} not assessed
          </span>
        )}
      </div>

      {(thinlyEvidenced > 0 || overrideCount > 0) && (
        <div className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {thinlyEvidenced > 0 && (
            <p>
              <span className="font-medium text-foreground">
                {thinlyEvidenced} {plural(thinlyEvidenced)} rated on low confidence.
              </span>{" "}
              Treat those rows as a prompt for a follow-up conversation, not as a finding.
            </p>
          )}
          {overrideCount > 0 && (
            <p>
              <span className="text-sky-600">✏</span> marks a level an assessor corrected. The struck-through value is
              what the model proposed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
