import {
  LEVEL_LABELS,
  FIT_GAP_RESULT_LABELS,
  FIT_GAP_RESULT_CLASSES,
  NOT_ASSESSED_REASON_LABELS,
} from "@/utils/constants";
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
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

// The API sends expected_level; reports stored before sub-PR 4 only have required_level (P1-2).
const requiredLevel = (c: SkillComparison) => c.expected_level ?? c.required_level;

const plural = (n: number) => `${n} skill${n !== 1 ? "s" : ""}`;

// On a phone each row stacks into a block and each value shows its column name from data-label (AC-29).
const cellClass =
  "flex items-center justify-between gap-3 px-4 py-1 sm:table-cell sm:py-2.5 sm:text-center " +
  "before:content-[attr(data-label)] before:text-xs before:text-muted-foreground sm:before:content-none";

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const count = (result: SkillComparison["result"]) => comparisons.filter((c) => c.result === result).length;
  const matchCount = count("match");
  const gapCount = count("gap");
  const exceedCount = count("exceed");
  const notAssessedCount = count("not_assessed");

  return (
    <div className="space-y-3">
      <div className="rounded-lg border sm:overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="hidden sm:table-header-group">
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {comparisons.map((c) => {
              const required = requiredLevel(c);
              const reason = c.not_assessed_reason ? NOT_ASSESSED_REASON_LABELS[c.not_assessed_reason] : null;

              return (
                <tr key={c.skill_label} className="block border-b py-2 last:border-0 sm:table-row sm:py-0">
                  <td className="block px-4 pb-1 sm:table-cell sm:py-2.5">
                    <span className="font-medium sm:font-normal break-words">{c.skill_label}</span>
                    {/* An unknown, not a weakness: say why, and what to do next (AC-25). */}
                    {c.result === "not_assessed" && (
                      <span className="block text-xs text-muted-foreground">
                        {reason ?? "No level from the interview"}: probe it in the next interview.
                      </span>
                    )}
                  </td>
                  <td data-label="Required" className={cn(cellClass, "text-muted-foreground")}>
                    {required != null ? LEVEL_LABELS[required] : "—"}
                  </td>
                  <td data-label="Candidate" className={cellClass}>
                    {c.candidate_level != null ? (
                      <span>
                        {LEVEL_LABELS[c.candidate_level]}
                        {c.is_override && (
                          <span className="text-xs text-muted-foreground ml-1" title="Rated by an assessor">✏</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td data-label="Result" className={cellClass}>
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary: unknowns are counted on their own, never folded into gaps (P2-5) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {matchCount > 0 && <span>✅ Match: {plural(matchCount)}</span>}
        {gapCount > 0 && <span>⚠ Gap: {plural(gapCount)}</span>}
        {exceedCount > 0 && <span>⭐ Exceeds: {plural(exceedCount)}</span>}
        {notAssessedCount > 0 && <span>— Not assessed: {plural(notAssessedCount)}</span>}
        <span className="sm:ml-auto">✏ = rated by an assessor</span>
      </div>
    </div>
  );
}
