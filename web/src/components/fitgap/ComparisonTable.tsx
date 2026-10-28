import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const levelLabel = (level?: number | null) =>
  level == null ? "—" : LEVEL_LABELS[level] ?? `L${level}`;

function plural(count: number, noun: string) {
  return `${count} ${noun}${count !== 1 ? "s" : ""}`;
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let icon = "—";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") { icon = "⭐"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = "⚠"; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

// The candidate's level, plus the two things a reader must not miss: a person changed it,
// or the model is unsure about it.
function CandidateLevel({ comparison }: { comparison: SkillComparison }) {
  if (comparison.candidate_level == null) {
    return <span className="text-muted-foreground">Not assessed</span>;
  }

  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-1">
      <span>{levelLabel(comparison.candidate_level)}</span>
      {comparison.is_override && (
        <span role="img" aria-label="Level set by an assessor" title="Level set by an assessor" className="text-xs text-muted-foreground">
          ✏
        </span>
      )}
      {comparison.low_confidence && (
        <span
          className="whitespace-nowrap text-xs font-medium text-amber-700 border border-amber-300 rounded px-1.5 py-0.5"
          title="Based on little interview evidence. Review before deciding."
        >
          Low confidence
        </span>
      )}
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (comparisons.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground py-4 text-center">
        This vacancy has no required skills to compare yet.
      </p>
    );
  }

  const count = (result: SkillComparison["result"]) => comparisons.filter((c) => c.result === result).length;
  const matchCount = count("match");
  const gapCount = count("gap");
  const exceedCount = count("exceed");
  const unassessedCount = count("not_assessed");
  const lowConfidenceCount = comparisons.filter((c) => c.low_confidence).length;

  return (
    <div className="space-y-3">
      {unassessedCount > 0 && (
        <p role="status" className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2">
          {unassessedCount} of {plural(comparisons.length, "required skill")} {unassessedCount === 1 ? "was" : "were"} not
          assessed in this interview, so this comparison is incomplete.
        </p>
      )}

      {/* Wide screens: table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border">
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
              <tr key={`${c.skill_id ?? ""}-${c.skill_label}`} className="border-b last:border-0">
                <td className="px-4 py-2.5 break-words">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">{levelLabel(c.expected_level)}</td>
                <td className="px-4 py-2.5 text-center"><CandidateLevel comparison={c} /></td>
                <td className="px-4 py-2.5 text-center"><ResultBadge comparison={c} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Narrow screens: one card per skill, so nothing needs sideways scrolling */}
      <ul aria-label="Skill comparison" className="sm:hidden space-y-2">
        {comparisons.map((c) => (
          <li key={`${c.skill_id ?? ""}-${c.skill_label}`} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-sm break-words min-w-0">{c.skill_label}</span>
              <ResultBadge comparison={c} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Required</dt>
                <dd>{levelLabel(c.expected_level)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Candidate</dt>
                <dd><CandidateLevel comparison={c} /></dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {matchCount > 0 && <span>✅ Match: {plural(matchCount, "skill")}</span>}
        {gapCount > 0 && <span>⚠ Gap: {plural(gapCount, "skill")}</span>}
        {exceedCount > 0 && <span>⭐ Exceeds: {plural(exceedCount, "skill")}</span>}
        {unassessedCount > 0 && <span>— Not assessed: {plural(unassessedCount, "skill")}</span>}
        {lowConfidenceCount > 0 && <span>Low confidence: {plural(lowConfidenceCount, "skill")}</span>}
        <span className="sm:ml-auto">✏ = level set by an assessor</span>
      </div>
    </div>
  );
}
