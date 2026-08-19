import { Link } from "react-router-dom";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
  assessmentId?: string;
  sessionId?: string;
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") {
    icon = "⭐";
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    icon = "⚠";
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded",
        classes,
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
      {suffix}
    </span>
  );
}

export default function ComparisonTable({
  comparisons,
  assessmentId,
  sessionId,
}: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Skill-by-skill comparison between the candidate assessment and the vacancy requirements
          </caption>
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="text-left px-4 py-2.5 font-medium">
                Skill
              </th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">
                Required
              </th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">
                Candidate
              </th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium">
                Result
              </th>
              {assessmentId && sessionId && (
                <th scope="col" className="text-right px-4 py-2.5 font-medium">
                  <span className="sr-only">Evidence</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2.5">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.required_level]}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && (
                        <span
                          className="text-xs text-muted-foreground ml-1"
                          title="Override applied"
                        >
                          ✏
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
                {assessmentId && sessionId && (
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      to={`/assessments/${assessmentId}/sessions/${sessionId}/portfolio?skill=${encodeURIComponent(c.skill_label)}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      title={`View evidence for ${c.skill_label}`}
                    >
                      Evidence
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span>
            ✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span>
            ⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span>
            ⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto">✏ = human override applied</span>
      </div>
    </div>
  );
}
