import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { countByResult, normalizeSkillComparisons, type ApiSkillComparison } from "@/utils/fitGapDisplay";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: Array<SkillComparison | ApiSkillComparison>;
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") {
    icon = "⭐";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠";
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  } else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}
      {suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const rows = normalizeSkillComparisons(comparisons as ApiSkillComparison[]);
  const matchCount = countByResult(rows, "match");
  const gapCount = countByResult(rows, "gap");
  const exceedCount = countByResult(rows, "exceed");
  const notAssessedCount = countByResult(rows, "not_assessed");

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
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr
                key={`${c.skill_label}-${i}`}
                className={cn(
                  "border-b last:border-0",
                  c.result === "not_assessed" && "bg-amber-50/60"
                )}
              >
                <td className="px-4 py-2.5 break-anywhere max-w-[12rem] sm:max-w-none">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.required_level] ?? `L${c.required_level}`}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      {LEVEL_LABELS[c.candidate_level] ?? `L${c.candidate_level}`}
                      {c.is_override && (
                        <span className="text-xs text-muted-foreground ml-1">✏</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span>
            ✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span>
            ⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span>
            ⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        {notAssessedCount > 0 && (
          <span className="text-amber-700 font-medium">
            — Not assessed: {notAssessedCount} skill
            {notAssessedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto">✏ = human override applied</span>
      </div>
    </div>
  );
}
