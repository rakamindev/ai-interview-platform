import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";
import { CheckCircle2, AlertTriangle, Star, HelpCircle } from "lucide-react";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] || comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] || "text-neutral-500 bg-neutral-50";

  let icon = <span className="text-xs">—</span>;
  let suffix = "";

  if (comparison.result === "match") {
    icon = <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
  } else if (comparison.result === "exceed") {
    icon = <Star className="h-3.5 w-3.5 text-emerald-600" />;
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  } else if (comparison.result === "not_assessed") {
    icon = <HelpCircle className="h-3.5 w-3.5 text-neutral-400" />;
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const totalCount = comparisons.length;
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="space-y-4">
      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground font-medium">Matches</p>
          <p className="text-xl font-bold text-green-700 mt-0.5">{matchCount} <span className="text-xs text-muted-foreground font-normal">/ {totalCount}</span></p>
        </div>
        <div className="border rounded-lg p-3 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground font-medium">Exceeds</p>
          <p className="text-xl font-bold text-emerald-700 mt-0.5">{exceedCount} <span className="text-xs text-muted-foreground font-normal">/ {totalCount}</span></p>
        </div>
        <div className="border rounded-lg p-3 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground font-medium">Gaps</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5">{gapCount} <span className="text-xs text-muted-foreground font-normal">/ {totalCount}</span></p>
        </div>
        <div className="border rounded-lg p-3 bg-card shadow-xs">
          <p className="text-xs text-muted-foreground font-medium">Not Assessed</p>
          <p className="text-xl font-bold text-neutral-600 mt-0.5">{notAssessedCount} <span className="text-xs text-muted-foreground font-normal">/ {totalCount}</span></p>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-muted-foreground font-semibold">
              <th className="text-left px-4 py-3">Skill Requirement</th>
              <th className="text-center px-4 py-3">Required</th>
              <th className="text-center px-4 py-3">Candidate Rating</th>
              <th className="text-center px-4 py-3">Fit Assessment</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {comparisons.map((c, i) => {
              const reqLevel = c.expected_level ?? c.required_level;

              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {c.skill_label}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {reqLevel != null ? (
                      <span className="inline-block px-2 py-0.5 font-semibold text-xs rounded bg-muted text-muted-foreground">
                        {LEVEL_LABELS[reqLevel] || `L${reqLevel}`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.candidate_level != null ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary">
                          {LEVEL_LABELS[c.candidate_level] || `L${c.candidate_level}`}
                        </span>
                        {c.is_override && (
                          <span
                            className="text-xs text-amber-600 font-bold cursor-help px-1 py-0.5 rounded bg-amber-50 border border-amber-200"
                            title="Assessor human override applied"
                          >
                            ✏ Override
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic bg-neutral-100 px-2 py-0.5 rounded">
                        Not Assessed
                      </span>
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

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
        <span>Evaluated against vacancy benchmarks</span>
        <span className="flex items-center gap-1">
          <span className="text-amber-600 font-semibold">✏ Override</span> indicates rating adjusted by certified human assessor
        </span>
      </div>
    </div>
  );
}
