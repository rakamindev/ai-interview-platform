import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "text-neutral-600 bg-neutral-100";

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") {
    icon = "✅";
  } else if (comparison.result === "exceed") {
    icon = "⭐";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠️";
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  } else {
    icon = "⚪";
  }

  return (
    <span
      data-testid={`result-badge-${comparison.skill_label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-black/5 transition-colors",
        classes
      )}
    >
      <span className="text-[11px]">{icon}</span>
      <span>{label}</span>
      {suffix && <span className="font-semibold">{suffix}</span>}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (!comparisons || comparisons.length === 0) {
    return (
      <div
        data-testid="comparison-empty-state"
        className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
      >
        <p className="font-medium text-foreground">No Skill Comparisons Available</p>
        <p className="text-xs text-muted-foreground mt-1">
          This vacancy currently has no required skills configured for comparison.
        </p>
      </div>
    );
  }

  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="space-y-4" data-testid="comparison-table-container">
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold">Skill</th>
              <th className="text-center px-4 py-3 font-semibold">Required</th>
              <th className="text-center px-4 py-3 font-semibold">Candidate</th>
              <th className="text-center px-4 py-3 font-semibold">Evaluation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {comparisons.map((c, i) => {
              // Resilient level retrieval: backend returns expected_level, previous frontend used required_level
              const requiredLvl = c.expected_level ?? c.required_level;
              const requiredText = requiredLvl ? (LEVEL_LABELS[requiredLvl] ?? `L${requiredLvl}`) : "—";
              const candidateText =
                c.candidate_level != null
                  ? LEVEL_LABELS[c.candidate_level] ?? `L${c.candidate_level}`
                  : null;

              return (
                <tr
                  key={c.skill_label || i}
                  data-testid={`skill-row-${c.skill_label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {c.skill_label}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      {requiredText}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {candidateText ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center font-mono text-xs font-semibold px-2 py-0.5 rounded border border-black/5",
                            c.candidate_level && LEVEL_BADGE_CLASSES[c.candidate_level]
                              ? LEVEL_BADGE_CLASSES[c.candidate_level]
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {candidateText}
                        </span>
                        {c.is_override && (
                          <span
                            title="Assessor human override applied"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-amber-100 text-amber-800 border border-amber-200"
                          >
                            ✏️ Override
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/80 italic px-2 py-0.5 rounded bg-muted/40">
                        Not assessed
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

      {/* Summary KPI Badges */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-green-50 text-green-700 border border-green-200">
            <span className="font-semibold">✅ Match:</span> {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="font-semibold">⭐ Exceeds:</span> {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
            <span className="font-semibold">⚠️ Gap:</span> {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {notAssessedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
            <span className="font-semibold">⚪ Unassessed:</span> {notAssessedCount} skill{notAssessedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
          <span>✏️</span> Human assessor override applied
        </span>
      </div>
    </div>
  );
}

