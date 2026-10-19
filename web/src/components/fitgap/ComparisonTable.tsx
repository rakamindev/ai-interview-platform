import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] || comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] || "bg-muted text-muted-foreground";

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") {
    icon = "⭐";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠";
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  } else {
    icon = "—";
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded shadow-sm", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (!comparisons || comparisons.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
        No skills compared in this report.
      </div>
    );
  }

  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;
  const overrideCount = comparisons.filter((c) => c.is_override).length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-muted-foreground font-medium">
              <th className="text-left px-4 py-2.5">Skill</th>
              <th className="text-center px-4 py-2.5">Required</th>
              <th className="text-center px-4 py-2.5">Candidate Evaluation</th>
              <th className="text-center px-4 py-2.5">Fit / Gap Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {comparisons.map((c, i) => {
              const reqLvl = c.required_level ?? c.expected_level;
              const hasCandidate = c.candidate_level != null;

              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div>{c.skill_label}</div>
                    {c.confidence && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Confidence: {c.confidence}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground font-medium">
                    {reqLvl ? LEVEL_LABELS[reqLvl] || `Level ${reqLvl}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {hasCandidate ? (
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                        <span className="font-semibold text-foreground">
                          {LEVEL_LABELS[c.candidate_level!] || `Level ${c.candidate_level}`}
                        </span>
                        {c.is_override && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 rounded-md px-1.5 py-0.5 cursor-help"
                            title={
                              c.assessor_notes
                                ? `Human Assessor Override\nNew: Level ${c.candidate_level} (AI was Level ${c.ai_level ?? "?"})\nNotes: ${c.assessor_notes}`
                                : `Human Assessor Override: Level ${c.candidate_level} (AI was Level ${c.ai_level ?? "?"})`
                            }
                          >
                            ✏ Override
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">Not assessed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">
            ✅ Match: {matchCount}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
            ⭐ Exceeds: {exceedCount}
          </span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
            ⚠ Gap: {gapCount}
          </span>
        )}
        {notAssessedCount > 0 && (
          <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded">
            — Not Assessed: {notAssessedCount}
          </span>
        )}
        {overrideCount > 0 && (
          <span className="ml-auto text-amber-700 font-medium">
            ✏ {overrideCount} human override{overrideCount > 1 ? "s" : ""} applied
          </span>
        )}
      </div>
    </div>
  );
}
