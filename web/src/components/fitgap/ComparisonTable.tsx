import { AlertTriangle, ArrowDown, ArrowUp, Check, CircleDashed, PenLine } from "lucide-react";
import { FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";
import { levelLabel, summarizeComparisons } from "./comparisonSummary";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const RESULT_ICONS = {
  match: Check,
  exceed: ArrowUp,
  gap: ArrowDown,
  not_assessed: CircleDashed,
} as const;

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const result = comparison.result in RESULT_ICONS ? comparison.result : "not_assessed";
  const Icon = RESULT_ICONS[result];
  const delta = comparison.delta ?? 0;
  const suffix = result === "exceed" || result === "gap" ? ` ${delta > 0 ? "+" : ""}${delta}` : "";

  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded", FIT_GAP_RESULT_CLASSES[result])}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {FIT_GAP_RESULT_LABELS[result]}
      {suffix}
    </span>
  );
}

function Level({ level }: { level: number | null | undefined }) {
  const label = levelLabel(level);
  return label ? <span>{label}</span> : <span className="text-muted-foreground" aria-label="No level">—</span>;
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (comparisons.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        This vacancy has no required skills yet, so there is nothing to compare.
      </p>
    );
  }

  const { total, counts, hasOverride } = summarizeComparisons(comparisons);

  return (
    <div className="space-y-3">
      {counts.not_assessed > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {counts.not_assessed} of {total} required skill{total !== 1 ? "s were" : " was"} not assessed in the interview.
            Treat this report as incomplete and do not read a missing skill as a gap.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">Required</th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c) => (
              <tr key={c.skill_id ?? c.skill_label} className="border-b last:border-0">
                <th scope="row" className="max-w-xs break-words px-4 py-2.5 text-left font-normal">{c.skill_label}</th>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  <Level level={c.expected_level} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="inline-flex items-center gap-1">
                    <Level level={c.candidate_level} />
                    {c.is_override && (
                      <PenLine className="h-3.5 w-3.5 text-muted-foreground" aria-label="Level set by an assessor override" />
                    )}
                  </span>
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
        <span>Match: {counts.match}</span>
        <span>Exceeds: {counts.exceed}</span>
        <span>Gap: {counts.gap}</span>
        <span>Not assessed: {counts.not_assessed}</span>
        {hasOverride && (
          <span className="inline-flex items-center gap-1 sm:ml-auto">
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> Assessor override applied
          </span>
        )}
      </div>
    </div>
  );
}
