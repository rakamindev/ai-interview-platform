import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") { icon = "⭐"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = "⚠"; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }
  else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

// Verdicts that rest on thin or missing evidence must be visibly flagged so
// nobody treats an under-explored rating as a factual decision.
function ConfidenceFlag({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result === "match") return null;
  if (!comparison.low_confidence_flag) return null;

  return (
    <span
      title={
        comparison.result === "not_assessed"
          ? "Skill was not assessed — treat as unknown, not as a pass or fail"
          : "This verdict relies on a low-confidence rating — verify before acting on it"
      }
      className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 text-xs font-medium"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {comparison.result === "not_assessed" ? "not probed" : "low confidence"}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  if (comparisons.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No required skills defined for this vacancy yet. Add skills to the vacancy to run a comparison.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
              <th className="text-left px-4 py-2.5 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2.5">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {c.expected_level != null ? LEVEL_LABELS[c.expected_level] : "—"}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span className="inline-flex items-center gap-1">
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && (
                        <span title="Human override applied" className="text-xs">✏️</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
                <td className="px-4 py-2.5 text-left">
                  <ConfidenceFlag comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && <span>✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>}
        {gapCount > 0 && <span>⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>}
        {exceedCount > 0 && <span>⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>}
        <span className="ml-auto">✏️ = human override</span>
        <span className="text-amber-600">● = low confidence / not probed — verify before deciding</span>
      </div>
    </div>
  );
}