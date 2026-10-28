import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";
import { CheckCircle2, Star, AlertTriangle, Minus, Pencil } from "lucide-react";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let icon = <Minus className="h-3.5 w-3.5 text-neutral-400" />;
  let suffix = "";

  if (comparison.result === "match") {
    icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  } else if (comparison.result === "exceed") {
    icon = <Star className="h-3.5 w-3.5 text-blue-600 fill-blue-600/20" />;
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  } else if (comparison.result === "not_assessed") {
    icon = <Minus className="h-3.5 w-3.5 text-neutral-400" />;
  }

  return (
    <span
      data-testid={`result-badge-${comparison.result}`}
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded", classes)}
    >
      {icon} <span>{label}{suffix}</span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="space-y-3" data-testid="comparison-table">
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-neutral-50/75">
              <th className="text-left px-4 py-2.5 font-medium text-neutral-700">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium text-neutral-700">Required</th>
              <th className="text-center px-4 py-2.5 font-medium text-neutral-700">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium text-neutral-700">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => {
              const reqLevel = c.required_level ?? c.expected_level;
              return (
                <tr key={i} className="border-b last:border-0 hover:bg-neutral-50/40">
                  <td className="px-4 py-2.5 font-medium text-neutral-900">{c.skill_label}</td>
                  <td className="px-4 py-2.5 text-center text-neutral-600 font-medium">
                    {reqLevel ? LEVEL_LABELS[reqLevel] : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {c.candidate_level != null && c.candidate_level > 0 ? (
                      <span className="inline-flex items-center justify-center gap-1">
                        <span>{LEVEL_LABELS[c.candidate_level]}</span>
                        {c.is_override && (
                          <span title="Human override applied" className="text-neutral-500 inline-flex items-center">
                            <Pencil className="h-3 w-3" />
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-neutral-400 font-mono">-</span>
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

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600 pt-1" data-testid="comparison-summary">
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-blue-700">
            <Star className="h-3.5 w-3.5 text-blue-600 fill-blue-600/20" />
            Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        {notAssessedCount > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-neutral-500" data-testid="summary-not-assessed">
            <Minus className="h-3.5 w-3.5 text-neutral-400" />
            Belum dinilai: {notAssessedCount} skill{notAssessedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-neutral-400">
          <Pencil className="h-3 w-3" /> = human override applied
        </span>
      </div>
    </div>
  );
}
