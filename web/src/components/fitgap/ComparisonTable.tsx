import { Pencil } from "lucide-react";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "text-neutral-500 bg-neutral-50";

  let icon = "";
  let suffix = "";
  if (comparison.result === "match") icon = "✅";
  else if (comparison.result === "exceed") { icon = "⭐"; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = "⚠"; suffix = comparison.delta ? ` ${comparison.delta}` : ""; }
  else if (comparison.result === "insufficient_evidence") icon = "❓";
  else icon = "—";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {icon} {label}{suffix}
    </span>
  );
}

function CandidateCell({ comparison }: { comparison: SkillComparison }) {
  const { result, candidate_level, provisional_level, ai_level, is_override } = comparison;

  // A human override speaks for the row regardless of underlying status —
  // show what the AI said (if anything) and what the assessor decided.
  if (is_override && candidate_level != null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs" title="Assessor override">
        <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
        {ai_level != null && (
          <span className="text-muted-foreground">AI {LEVEL_LABELS[ai_level]} →</span>
        )}
        <span className="font-medium text-foreground">Assessor {LEVEL_LABELS[candidate_level]}</span>
      </span>
    );
  }

  if (result === "match" || result === "gap" || result === "exceed") {
    return <span>{candidate_level != null ? LEVEL_LABELS[candidate_level] : "—"}</span>;
  }

  if (result === "insufficient_evidence") {
    return (
      <span className="text-muted-foreground text-xs">
        {provisional_level != null ? `${LEVEL_LABELS[provisional_level]} (low evidence)` : "Low evidence"}
      </span>
    );
  }

  // not_assessed
  return <span className="text-muted-foreground">—</span>;
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const unassessedCount = comparisons.filter(
    (c) => c.result === "insufficient_evidence" || c.result === "not_assessed"
  ).length;

  return (
    <div className="space-y-3">
      {unassessedCount > 0 && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {unassessedCount} of {comparisons.length} skill{comparisons.length === 1 ? "" : "s"} could not be
          fully assessed in this interview. That reflects interview coverage, not candidate ability —
          see the Result column below.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Confidence</th>
              <th className="text-center px-4 py-2.5 font-medium">Evidence</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2.5">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.expected_level]}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <CandidateCell comparison={c} />
                </td>
                <td className="px-4 py-2.5 text-center text-xs text-muted-foreground capitalize">
                  {c.confidence ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                  {c.evidence_count}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {matchCount > 0 && <span>✅ Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>}
        {gapCount > 0 && <span>⚠ Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>}
        {exceedCount > 0 && <span>⭐ Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>}
        <span className="ml-auto">✏ = human override applied</span>
      </div>
    </div>
  );
}
