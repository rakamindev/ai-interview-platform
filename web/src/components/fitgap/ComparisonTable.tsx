import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const result = comparison.result;
  const knownResult = result === "match" || result === "gap" || result === "exceed" || result === "not_assessed";
  const label = knownResult ? FIT_GAP_RESULT_LABELS[result] : "Unknown result";
  const classes = knownResult ? FIT_GAP_RESULT_CLASSES[result] : "text-muted-foreground bg-muted";

  let icon = "";
  let suffix = "";
  const delta = typeof comparison.delta === "number" && Number.isFinite(comparison.delta)
    ? comparison.delta
    : null;
  if (result === "match") icon = "✅";
  else if (result === "exceed") {
    icon = "⭐";
    suffix = delta ? ` +${delta}` : "";
  } else if (result === "gap") {
    icon = "⚠";
    suffix = delta ? ` -${Math.abs(delta)}` : "";
  } else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-xs font-medium", classes)}>
      <span aria-hidden="true">{icon}</span>
      {label}{suffix}
    </span>
  );
}

function levelLabel(level: number | null | undefined) {
  return level != null && Number.isInteger(level) ? LEVEL_LABELS[level] ?? null : null;
}

export default function ComparisonTable({ comparisons = [] }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      <div
        className="w-full overflow-x-auto rounded-lg border"
        role="region"
        aria-label="Skill comparison table"
        tabIndex={0}
      >
        <table className="w-full min-w-[36rem] table-fixed text-sm">
          <thead className="sticky top-0">
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-4 py-3 text-left font-semibold">Skill</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">Required</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">Candidate</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => {
              const skillLabel = typeof c.skill_label === "string" && c.skill_label.trim()
                ? c.skill_label
                : "Skill name unavailable";
              return (
                <tr key={c.skill_id ?? `${skillLabel}-${i}`} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                  <td className="max-w-0 px-4 py-3">
                    <span className="block truncate font-medium" title={skillLabel}>
                      {skillLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {levelLabel(c.expected_level) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {levelLabel(c.candidate_level) ? (
                      <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                        {levelLabel(c.candidate_level)}
                        {c.overridden && (
                          <span
                            role="img"
                            aria-label="Human override applied"
                            title="Human override applied"
                            className="text-xs text-muted-foreground"
                          >
                            ✏
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground" aria-label="Not assessed">—</span>
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {matchCount > 0 && <span>✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>}
        {gapCount > 0 && <span>⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>}
        {exceedCount > 0 && <span>⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>}
        <span className="sm:ml-auto">✏ = human override applied</span>
      </div>
    </div>
  );
}
