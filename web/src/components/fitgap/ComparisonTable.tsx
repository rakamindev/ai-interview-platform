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
  else if (comparison.result === "exceed") { icon = "⭐"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = "⚠"; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }
  else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  // Group comparisons
  const gaps = comparisons.filter((c) => c.result === "gap");
  const matches = comparisons.filter((c) => c.result === "match");
  const exceeds = comparisons.filter((c) => c.result === "exceed");
  const notAssessed = comparisons.filter((c) => c.result === "not_assessed");
  
  const renderRow = (c: SkillComparison, i: number) => (
    <tr key={`${c.skill_label}-${i}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5 font-medium">{c.skill_label}</td>
      <td className="px-4 py-2.5 text-center text-muted-foreground">
        {LEVEL_LABELS[c.required_level]}
      </td>
      <td className="px-4 py-2.5 text-center">
        {c.candidate_level != null ? (
          <span>
            {LEVEL_LABELS[c.candidate_level]}
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
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4 text-sm font-medium bg-muted/30 px-4 py-3 rounded-lg border">
        {gapCount > 0 && <span className="text-red-600 dark:text-red-400">⚠ Gaps: {gapCount}</span>}
        {matchCount > 0 && <span className="text-green-600 dark:text-green-400">✅ Matches: {matchCount}</span>}
        {exceedCount > 0 && <span className="text-amber-600 dark:text-amber-500">⭐ Exceeds: {exceedCount}</span>}
        <span className="ml-auto text-xs text-muted-foreground font-normal">✏ = human override applied</span>
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Skill</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Required</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Candidate</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Result</th>
            </tr>
          </thead>
          {gaps.length > 0 && (
            <tbody className="group">
              <tr className="bg-red-50/50 dark:bg-red-950/20 border-b">
                <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Priority Gaps</td>
              </tr>
              {gaps.map(renderRow)}
            </tbody>
          )}
          {matches.length > 0 && (
            <tbody className="group border-t-2 border-t-muted/50">
              <tr className="bg-green-50/50 dark:bg-green-950/20 border-b">
                <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">Matched Requirements</td>
              </tr>
              {matches.map(renderRow)}
            </tbody>
          )}
          {exceeds.length > 0 && (
            <tbody className="group border-t-2 border-t-muted/50">
              <tr className="bg-amber-50/50 dark:bg-amber-950/20 border-b">
                <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-500 uppercase tracking-wider">Exceeding Expectations</td>
              </tr>
              {exceeds.map(renderRow)}
            </tbody>
          )}
          {notAssessed.length > 0 && (
            <tbody className="group border-t-2 border-t-muted/50">
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/20 border-b">
                <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Not Assessed</td>
              </tr>
              {notAssessed.map(renderRow)}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
