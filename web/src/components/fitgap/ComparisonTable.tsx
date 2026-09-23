import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let suffix = "";
  if (comparison.result === "exceed") suffix = comparison.delta ? ` +${comparison.delta}` : "";
  else if (comparison.result === "gap") suffix = comparison.delta ? ` −${Math.abs(comparison.delta)}` : "";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 border", classes)}>
      {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-foreground/15">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Skill</th>
              <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Required</th>
              <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Candidate</th>
              <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b border-foreground/8 last:border-0">
                <td className="px-3 py-2.5 font-medium">{c.skill_label}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">
                  {LEVEL_LABELS[c.expected_level]}
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums">
                  {c.candidate_level != null ? (
                    <span>
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && <span className="text-xs text-muted-foreground ml-1">✎</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {matchCount > 0 && <span>Match: {matchCount}</span>}
        {gapCount > 0 && <span>Gap: {gapCount}</span>}
        {exceedCount > 0 && <span>Exceeds: {exceedCount}</span>}
        <span className="sm:ml-auto">✎ = human override</span>
      </div>
    </div>
  );
}
