import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] || comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] || "text-neutral-600 bg-neutral-100";

  let icon = "—";
  let suffix = "";
  if (comparison.result === "match") {
    icon = "✓";
  } else if (comparison.result === "exceed") {
    icon = "★";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠";
    suffix = comparison.delta ? ` ${comparison.delta}` : "";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shadow-xs transition-colors",
        classes
      )}
    >
      <span className="text-xs">{icon}</span>
      <span>{label}{suffix}</span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  if (!comparisons || comparisons.length === 0) {
    return (
      <div className="p-8 text-center border rounded-xl bg-card text-muted-foreground">
        No skill requirements configured for this vacancy.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="px-5 py-3.5 font-medium">Skill Dimension</th>
                <th className="px-5 py-3.5 font-medium text-center">Required Level</th>
                <th className="px-5 py-3.5 font-medium text-center">Candidate Level</th>
                <th className="px-5 py-3.5 font-medium text-center">Evaluation Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comparisons.map((c, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-4 font-medium text-foreground">
                    <div className="flex flex-col">
                      <span>{c.skill_label}</span>
                      {c.confidence && (
                        <span className="text-[11px] text-muted-foreground font-normal">
                          Confidence: {c.confidence}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded text-xs font-semibold bg-secondary text-secondary-foreground">
                      {LEVEL_LABELS[c.expected_level] || `L${c.expected_level}`}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {c.candidate_level != null ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                        {LEVEL_LABELS[c.candidate_level] || `L${c.candidate_level}`}
                        {c.is_override && (
                          <span
                            className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-normal"
                            title="Human assessor override applied"
                          >
                            ✏ Adjusted
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">— Not Assessed</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 border rounded-lg text-xs font-medium text-muted-foreground">
        <span className="font-semibold text-foreground">Summary:</span>
        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          ✓ {matchCount} Match{matchCount !== 1 ? "es" : ""}
        </span>
        <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
          ★ {exceedCount} Exceed{exceedCount !== 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          ⚠ {gapCount} Gap{gapCount !== 1 ? "s" : ""}
        </span>
        {notAssessedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            — {notAssessedCount} Not Assessed
          </span>
        )}
      </div>
    </div>
  );
}
