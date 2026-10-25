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
  else if (comparison.result === "exceed") {
    icon = "⭐";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠";
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta as number)}` : "";
  } else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

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
            {comparisons.map((c, i) => {
              const isOverride = c.overridden ?? c.is_override;
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-2.5">{c.skill_label}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">
                    {typeof c.expected_level === "number" ? (
                      LEVEL_LABELS[c.expected_level]
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {c.candidate_level != null ? (
                      <span>
                        {LEVEL_LABELS[c.candidate_level]}
                        {isOverride && (
                          <span className="text-xs text-muted-foreground ml-1" title="Human override applied">
                            ✏
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {c.result === "not_assessed" ? "Not assessed" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span>✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>
        )}
        {gapCount > 0 && <span>⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>}
        {exceedCount > 0 && (
          <span>⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>
        )}
        {notAssessedCount > 0 && (
          <span className="font-medium text-neutral-600">
            — Not assessed: {notAssessedCount} skill{notAssessedCount !== 1 ? "s" : ""} (not probed in
            interview)
          </span>
        )}
        <span className="ml-auto">✏ = human override applied</span>
      </div>
    </div>
  );
}
