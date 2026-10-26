import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
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
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("inline-flex items-center justify-center gap-1 sm:whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded", classes)}>
        <span aria-hidden>{icon}</span> {label}{suffix}
      </span>
      {/* A level from weak evidence must not read as a definitive verdict on the candidate. */}
      {comparison.low_confidence && (
        <span className="text-[11px] leading-tight text-amber-700">low confidence</span>
      )}
    </div>
  );
}

function CandidateCell({ comparison: c }: { comparison: SkillComparison }) {
  if (c.candidate_level == null) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1">
        {LEVEL_LABELS[c.candidate_level]}
        {c.is_override && (
          <span role="img" aria-label="Human override" title="Human override">
            <Pencil className="h-3 w-3 text-primary" aria-hidden />
          </span>
        )}
      </span>
      {/* AI level stays visible for audit (and on touch screens, where hover titles don't exist). */}
      {c.is_override && c.ai_level != null && (
        <span className="text-[11px] leading-tight text-muted-foreground">AI: {LEVEL_LABELS[c.ai_level]}</span>
      )}
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const count = (result: SkillComparison["result"]) => comparisons.filter((c) => c.result === result).length;
  const plural = (n: number) => `${n} skill${n !== 1 ? "s" : ""}`;
  const counts = [
    { key: "match", text: "✅ Match", n: count("match") },
    { key: "gap", text: "⚠ Gap", n: count("gap") },
    { key: "exceed", text: "⭐ Exceeds", n: count("exceed") },
    { key: "not_assessed", text: "— Not assessed", n: count("not_assessed") },
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs sm:text-sm">
              <th className="text-left px-2.5 sm:px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-1.5 sm:px-4 py-2.5 font-medium">
                <abbr title="Required level" className="no-underline sm:hidden">Req.</abbr>
                <span className="hidden sm:inline">Required</span>
              </th>
              <th className="text-center px-1.5 sm:px-4 py-2.5 font-medium">
                <abbr title="Candidate level" className="no-underline sm:hidden">Cand.</abbr>
                <span className="hidden sm:inline">Candidate</span>
              </th>
              <th className="text-center px-1.5 sm:px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={`${c.skill_label}-${i}`} className="border-b last:border-0 align-middle">
                {/* min width keeps short words whole on phones; long labels wrap at word boundaries */}
                <td className="min-w-[6rem] px-2.5 sm:px-4 py-2.5 break-words">{c.skill_label}</td>
                <td className="px-1.5 sm:px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.expected_level] ?? "—"}
                </td>
                <td className="px-1.5 sm:px-4 py-2.5 text-center">
                  <CandidateCell comparison={c} />
                </td>
                <td className="px-1.5 sm:px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary: unassessed skills are counted, never hidden */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {counts
          .filter(({ n }) => n > 0)
          .map(({ key, text, n }) => (
            <span key={key}>{text}: {plural(n)}</span>
          ))}
        {comparisons.some((c) => c.is_override) && (
          <span className="inline-flex items-center gap-1 sm:ml-auto">
            <Pencil className="h-3 w-3 text-primary" aria-hidden /> = human override
          </span>
        )}
      </div>
    </div>
  );
}
