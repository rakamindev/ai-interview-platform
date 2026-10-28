import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { requiredLevelOf, summarizeCoverage } from "@/utils/fitgap";
import { cn } from "@/lib/utils";
import type { FitGapCoverage, SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
  coverage?: FitGapCoverage;
}

function levelText(level?: number | null) {
  if (level == null) return "—";
  return LEVEL_LABELS[level] ?? `L${level}`;
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

export default function ComparisonTable({ comparisons, coverage }: ComparisonTableProps) {
  const list = comparisons ?? [];
  const summary = coverage ?? summarizeCoverage(list);

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No skills to compare. Add required skills to the vacancy first.
      </p>
    );
  }

  const matchCount = list.filter((c) => c.result === "match").length;
  const gapCount = list.filter((c) => c.result === "gap").length;
  const exceedCount = list.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      {!summary.complete && (
        <div
          role="status"
          className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800"
        >
          {summary.assessed === 0
            ? "None of the required skills were assessed, so there is nothing to compare."
            : `Only ${summary.assessed} of ${summary.total} required skills were assessed. ${summary.not_assessed} could not be evaluated, so this result is incomplete.`}
        </div>
      )}

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
            {list.map((c, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2.5 break-words max-w-[14rem]">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {levelText(requiredLevelOf(c))}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      {levelText(c.candidate_level)}
                      {c.is_override && <span className="text-xs text-muted-foreground ml-1">✏</span>}
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {matchCount > 0 && <span>✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>}
        {gapCount > 0 && <span>⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>}
        {exceedCount > 0 && <span>⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>}
        {summary.not_assessed > 0 && <span>— Not assessed: {summary.not_assessed}</span>}
        <span className="ml-auto">✏ = human override applied</span>
      </div>
    </div>
  );
}
