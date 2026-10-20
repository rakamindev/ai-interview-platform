import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { countResults, NOT_ASSESSED_REASON_COPY, pluralize } from "@/utils/skills";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const { result, delta } = comparison;
  const suffix = delta && result !== "match" ? ` ${delta > 0 ? "+" : "−"}${Math.abs(delta)}` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded",
        FIT_GAP_RESULT_CLASSES[result],
        result === "not_assessed" && "border border-dashed border-neutral-300"
      )}
    >
      {FIT_GAP_RESULT_LABELS[result]}
      {suffix}
    </span>
  );
}

function CandidateLevel({ comparison }: { comparison: SkillComparison }) {
  if (comparison.candidate_level == null) {
    return <span className="text-muted-foreground">No rating</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {LEVEL_LABELS[comparison.candidate_level]}
      {comparison.is_override && (
        <Pencil className="h-3 w-3 text-muted-foreground" aria-label="Adjusted by assessor" />
      )}
    </span>
  );
}

function ReasonNote({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result !== "not_assessed" || !comparison.not_assessed_reason) return null;

  return (
    <span className="block text-xs text-muted-foreground">
      {NOT_ASSESSED_REASON_COPY[comparison.not_assessed_reason]}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const counts = countResults(comparisons);
  const hasOverride = comparisons.some((c) => c.is_override);

  return (
    <div className="space-y-3">
      <div className="hidden sm:block overflow-x-auto rounded-lg border">
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
            {comparisons.map((c, i) => (
              <tr key={i} className={cn("border-b last:border-0", c.result === "not_assessed" && "bg-muted/30")}>
                <td className="px-4 py-2.5 break-words">
                  {c.skill_label}
                  <ReasonNote comparison={c} />
                </td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">{LEVEL_LABELS[c.expected_level]}</td>
                <td className="px-4 py-2.5 text-center">
                  <CandidateLevel comparison={c} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="sm:hidden divide-y rounded-lg border">
        {comparisons.map((c, i) => (
          <li key={i} className={cn("p-3 space-y-1.5", c.result === "not_assessed" && "bg-muted/30")}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-sm break-words min-w-0">{c.skill_label}</span>
              <ResultBadge comparison={c} />
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-muted-foreground">Required {LEVEL_LABELS[c.expected_level]}</span>
              <span>
                Candidate <CandidateLevel comparison={c} />
              </span>
            </div>
            <ReasonNote comparison={c} />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {counts.match > 0 && <span>Match: {pluralize(counts.match, "skill")}</span>}
        {counts.exceed > 0 && <span>Exceeds: {pluralize(counts.exceed, "skill")}</span>}
        {counts.gap > 0 && <span>Gap: {pluralize(counts.gap, "skill")}</span>}
        {counts.notAssessed > 0 && <span>Not assessed: {pluralize(counts.notAssessed, "skill")}</span>}
        {hasOverride && (
          <span className="sm:ml-auto inline-flex items-center gap-1">
            <Pencil className="h-3 w-3" /> adjusted by assessor
          </span>
        )}
      </div>
    </div>
  );
}
