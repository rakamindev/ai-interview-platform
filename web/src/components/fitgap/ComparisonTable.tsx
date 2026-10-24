import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
  portfolioPath?: string;
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

export default function ComparisonTable({ comparisons, portfolioPath }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const needsAssessmentCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="space-y-3">
      {comparisons.length === 0 && (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">This vacancy has no skills configured yet. Add role requirements to compare this portfolio.</p>
      )}
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
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium break-words">{c.skill_label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.confidence ? `${c.confidence} confidence · ` : ""}{c.evidence_count ?? 0} verified quote{c.evidence_count === 1 ? "" : "s"}
                  </span>
                  {c.reason && <span className="block text-xs text-amber-800 break-words">{c.reason}</span>}
                  {portfolioPath && c.portfolio_skill_id && (
                    <a className="block text-xs text-primary underline" href={`${portfolioPath}#skill-${c.portfolio_skill_id}`}>
                      Review portfolio evidence
                    </a>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.required_level] || "—"}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      {LEVEL_LABELS[c.candidate_level] || "—"}
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

      <div className="sm:hidden space-y-3">
        {comparisons.map((c, i) => (
          <article key={`${c.skill_id || c.skill_label}-${i}`} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-sm break-words">{c.skill_label}</h3>
              <ResultBadge comparison={c} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-muted-foreground">Required</dt><dd>{LEVEL_LABELS[c.required_level] || "—"}</dd></div>
                <div><dt className="text-muted-foreground">Candidate</dt><dd>{c.candidate_level == null ? "—" : LEVEL_LABELS[c.candidate_level]}{c.is_override && c.candidate_level != null && " · human override"}</dd></div>
            </dl>
            <p className="text-xs text-muted-foreground">{c.confidence || "No"} confidence · {c.evidence_count ?? 0} verified quote{c.evidence_count === 1 ? "" : "s"}</p>
            {c.is_override && c.candidate_level == null && <p className="text-xs text-muted-foreground">Override recorded; evidence remains insufficient.</p>}
            {c.reason && <p className="text-xs text-amber-800">{c.reason}</p>}
            {portfolioPath && c.portfolio_skill_id && (
              <a className="text-xs text-primary underline" href={`${portfolioPath}#skill-${c.portfolio_skill_id}`}>
                Review portfolio evidence
              </a>
            )}
          </article>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && <span>✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>}
        {gapCount > 0 && <span>⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>}
        {exceedCount > 0 && <span>⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>}
        {needsAssessmentCount > 0 && <span>Needs assessment: {needsAssessmentCount}</span>}
        {comparisons.some((c) => c.is_override) && <span className="ml-auto">✏ = human override recorded</span>}
      </div>
    </div>
  );
}
