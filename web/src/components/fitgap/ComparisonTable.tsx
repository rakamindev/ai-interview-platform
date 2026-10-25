import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { getComparisonResult } from "@/utils/fitGap";
import type { SkillComparison, SkillComparisonResult } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const result = getComparisonResult(comparison);
  const label = FIT_GAP_RESULT_LABELS[result];
  const classes = FIT_GAP_RESULT_CLASSES[result];

  let icon = "";
  let suffix = "";
  if (result === "match") icon = "✅";
  else if (result === "exceed") { icon = "⭐"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (result === "gap") { icon = "⚠"; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }
  else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

function ConfidenceLabel({ confidence }: { confidence: SkillComparison["confidence"] }) {
  if (!confidence) return null;

  const classes = {
    high: "text-emerald-700",
    medium: "text-amber-700",
    low: "text-red-700",
  }[confidence];

  return (
    <span className={cn("text-xs capitalize", classes)}>
      {confidence} confidence
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Empty state — a report with zero skill comparisons must not render a bare
  // table with no explanation (UI enhancement, Pilar 3).
  if (comparisons.length === 0) {
    return (
      <div className="py-8 text-center space-y-1">
        <p className="text-sm font-medium">No matching skills for this vacancy</p>
        <p className="text-xs text-muted-foreground">
          None of the assessed skills overlap with this vacancy's requirements.
        </p>
      </div>
    );
  }

  const resultPriority: Record<SkillComparisonResult, number> = {
    gap: 0,
    not_assessed: 1,
    match: 2,
    exceed: 3,
  };
  const prioritizedComparisons = [...comparisons].sort(
    (a, b) => resultPriority[getComparisonResult(a)] - resultPriority[getComparisonResult(b)]
  );

  return (
    <div className="rounded-lg sm:overflow-hidden sm:border">
      <table className="block w-full text-sm sm:table">
        <thead className="hidden sm:table-header-group">
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
        </thead>
        <tbody className="block space-y-3 sm:table-row-group sm:space-y-0">
            {prioritizedComparisons.map((c) => (
              <tr
                key={c.skill_id ?? c.skill_label}
                className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3.5 sm:table-row sm:rounded-none sm:border-0 sm:p-0 [&:not(:last-child)]:sm:border-b"
              >
                <td className="col-span-2 break-words font-semibold sm:table-cell sm:px-4 sm:py-2.5 sm:font-normal">
                  {c.skill_label}
                </td>
                <td className="sm:table-cell sm:px-4 sm:py-2.5 sm:text-center sm:text-muted-foreground">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                    Required
                  </span>
                  <span>{c.expected_level ? LEVEL_LABELS[c.expected_level] : "—"}</span>
                </td>
                <td className="sm:table-cell sm:px-4 sm:py-2.5 sm:text-center">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                    Candidate
                  </span>
                  {c.candidate_level != null ? (
                    <span className="inline-flex flex-col sm:items-center">
                      <span>{LEVEL_LABELS[c.candidate_level]}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.rating_source === "assessor_override" && c.ai_level != null
                          ? `Assessor-adjusted from ${LEVEL_LABELS[c.ai_level]}`
                          : "AI rating"}
                      </span>
                      <ConfidenceLabel confidence={c.confidence} />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="col-span-2 flex items-center justify-between gap-3 border-t pt-3 sm:table-cell sm:border-0 sm:px-4 sm:py-2.5 sm:text-center">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                    Result
                  </span>
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
