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
  else if (comparison.result === "gap") suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="space-y-3">
      {comparisons.length > 0 && (
        <div role="group" aria-label="Comparison summary" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Match", count: matchCount },
            { label: "Gap", count: gapCount },
            { label: "Exceeds", count: exceedCount },
            { label: "Not assessed", count: notAssessedCount },
          ].map(({ label, count }) => (
            <div key={label} className="rounded-lg border bg-card px-4 py-3">
              <p className="text-2xl font-semibold tabular-nums">{count}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}
      <div role="region" aria-label="Skill comparison table" tabIndex={0} className="overflow-x-auto rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-4 py-3 text-left font-medium">Skill</th>
              <th scope="col" className="px-4 py-3 text-center font-medium">Required</th>
              <th scope="col" className="px-4 py-3 text-center font-medium">Candidate</th>
              <th scope="col" className="px-4 py-3 text-center font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No skill comparisons are available for this vacancy.</td>
              </tr>
            ) : comparisons.map((c, i) => (
              <tr key={`${c.skill_label}-${i}`} className="border-b last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">{c.skill_label}</th>
                <td className="px-4 py-3 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.expected_level]}
                </td>
                <td className="px-4 py-3 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && <span className="ml-1 text-xs text-muted-foreground">(Assessor-adjusted)</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not assessed</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="sm:ml-auto">Assessor-adjusted scores are marked</span>
      </div>
    </div>
  );
}
