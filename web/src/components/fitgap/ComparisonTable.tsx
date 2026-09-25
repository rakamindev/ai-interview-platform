import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { BadgeCheck, CircleHelp, UserRoundCheck } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let suffix = "";
  if (comparison.result === "exceed" && comparison.delta) suffix = ` +${comparison.delta}`;
  if (comparison.result === "gap" && comparison.delta) suffix = ` -${Math.abs(comparison.delta)}`;

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", classes)}>
      {label}{suffix}
    </span>
  );
}

function ConfidenceBadge({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result === "not_assessed" || !comparison.confidence) {
    return <span className="text-xs text-muted-foreground">Unknown</span>;
  }

  const confidence = comparison.confidence.toLowerCase();
  const classes = confidence === "high"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : confidence === "medium"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize", classes)}>
      {confidence === "high" ? <BadgeCheck className="h-3 w-3" /> : <CircleHelp className="h-3 w-3" />}
      {confidence}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-muted-foreground">
            <th className="text-left px-4 py-3 font-medium">Skill</th>
            <th className="text-center px-4 py-3 font-medium">Required</th>
            <th className="text-center px-4 py-3 font-medium">Candidate</th>
            <th className="text-center px-4 py-3 font-medium">Confidence</th>
            <th className="text-center px-4 py-3 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map((comparison, index) => (
            <tr key={`${comparison.skill_id ?? comparison.skill_label}-${index}`} className="border-b last:border-0 align-middle">
              <td className="px-4 py-3.5">
                <div className="font-medium text-foreground">{comparison.skill_label}</div>
                {comparison.overridden && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRoundCheck className="h-3 w-3" /> Human override applied
                  </div>
                )}
              </td>
              <td className="px-4 py-3.5 text-center font-medium">
                {LEVEL_LABELS[comparison.expected_level] ?? `L${comparison.expected_level}`}
              </td>
              <td className="px-4 py-3.5 text-center">
                {comparison.candidate_level != null ? (
                  <span className="font-medium">
                    {LEVEL_LABELS[comparison.candidate_level] ?? `L${comparison.candidate_level}`}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not assessed</span>
                )}
              </td>
              <td className="px-4 py-3.5 text-center">
                <ConfidenceBadge comparison={comparison} />
              </td>
              <td className="px-4 py-3.5 text-center">
                <ResultBadge comparison={comparison} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
