import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "text-neutral-500 bg-neutral-50";

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") {
    icon = "✅";
  } else if (comparison.result === "exceed") {
    icon = "⭐";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠";
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  } else if (comparison.result === "not_assessed") {
    icon = "⚪";
  } else {
    icon = "—";
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border border-transparent", classes)}>
      <span>{icon}</span>
      <span>{label}{suffix}</span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const total = comparisons.length;
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  const qualifiedCount = matchCount + exceedCount;
  const matchPercentage = total > 0 ? Math.round((qualifiedCount / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Visual Fit Gauge */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="bg-muted/40 rounded-lg p-2.5 border">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Match Rate</div>
          <div className="text-xl font-bold text-primary mt-0.5">{matchPercentage}%</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{qualifiedCount} of {total} satisfied</div>
        </div>
        <div className="bg-green-50/50 rounded-lg p-2.5 border border-green-100">
          <div className="text-xs text-green-700 uppercase tracking-wider font-semibold">Match / Exceed</div>
          <div className="text-xl font-bold text-green-700 mt-0.5">{matchCount + exceedCount}</div>
          <div className="text-[11px] text-green-600 mt-0.5">{exceedCount} exceeding target</div>
        </div>
        <div className="bg-amber-50/50 rounded-lg p-2.5 border border-amber-100">
          <div className="text-xs text-amber-700 uppercase tracking-wider font-semibold">Skill Gaps</div>
          <div className="text-xl font-bold text-amber-700 mt-0.5">{gapCount}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Below expected level</div>
        </div>
        <div className="bg-slate-50/50 rounded-lg p-2.5 border border-slate-200">
          <div className="text-xs text-slate-600 uppercase tracking-wider font-semibold">Unassessed</div>
          <div className="text-xl font-bold text-slate-700 mt-0.5">{notAssessedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Not probed in session</div>
        </div>
      </div>

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
              const reqLevel = c.required_level ?? c.expected_level ?? 1;
              const candLevel = c.candidate_level ?? c.actual_level ?? c.effective_level;
              return (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{c.skill_label}</div>
                    {c.assessor_notes && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                        <span className="text-amber-600">✏ Note:</span>
                        <span>{c.assessor_notes}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground font-mono">
                    {LEVEL_LABELS[reqLevel] ?? `L${reqLevel}`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {candLevel != null ? (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-mono font-medium">
                          {LEVEL_LABELS[candLevel] ?? `L${candLevel}`}
                        </span>
                        {c.is_override && (
                          <span
                            className="inline-flex items-center text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-normal"
                            title={c.ai_level ? `AI evaluated L${c.ai_level}; manually overridden` : "Assessor override applied"}
                          >
                            ✏ Override {c.ai_level ? `(AI: L${c.ai_level})` : ""}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not assessed</span>
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

      {/* Summary Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-3">
          {matchCount > 0 && <span>✅ Match: {matchCount}</span>}
          {exceedCount > 0 && <span>⭐ Exceeds: {exceedCount}</span>}
          {gapCount > 0 && <span>⚠ Gap: {gapCount}</span>}
          {notAssessedCount > 0 && <span>⚪ Unassessed: {notAssessedCount}</span>}
        </div>
        <div className="text-[11px] text-muted-foreground">
          ✏ Human assessor override applied
        </div>
      </div>
    </div>
  );
}
