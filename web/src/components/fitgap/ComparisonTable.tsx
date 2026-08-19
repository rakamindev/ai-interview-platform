import { AlertTriangle, CheckCircle2, CircleDashed, ShieldCheck, Star } from "lucide-react";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];
  const delta = comparison.delta ?? 0;
  const suffix = comparison.result === "exceed" && delta > 0
    ? ` +${delta}`
    : comparison.result === "gap" && delta < 0
      ? ` ${delta}`
      : "";

  const Icon = {
    match: CheckCircle2,
    exceed: Star,
    gap: AlertTriangle,
    not_assessed: CircleDashed,
  }[comparison.result];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium", classes)}>
      <Icon className="h-3.5 w-3.5" />
      {label}{suffix}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const normalizedComparisons = comparisons.map((comparison) => ({
    ...comparison,
    required_level: comparison.required_level ?? comparison.expected_level,
  }));

  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;
  const overrideCount = comparisons.filter((c) => c.is_override).length;
  const lowConfidenceCount = comparisons.filter((c) => c.confidence?.toLowerCase() === "low").length;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="min-w-[220px] px-4 py-3 text-left font-medium">Skill</th>
              <th className="px-4 py-3 text-center font-medium">Required</th>
              <th className="px-4 py-3 text-center font-medium">Candidate</th>
              <th className="px-4 py-3 text-center font-medium">Confidence</th>
              <th className="px-4 py-3 text-center font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {normalizedComparisons.map((c, i) => (
              <tr
                key={`${c.skill_id || c.skill_label}-${i}`}
                className={cn(
                  "border-b last:border-0",
                  c.result === "not_assessed" && "bg-neutral-50/80",
                  c.delta != null && c.delta <= -2 && "bg-red-50/70"
                )}
              >
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-foreground">{c.skill_label}</div>
                  {c.is_override && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" />
                      Human override applied
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center align-top text-muted-foreground">
                  {LEVEL_LABELS[c.required_level]}
                </td>
                <td className="px-4 py-3 text-center align-top">
                  {c.candidate_level != null ? (
                    <span>{LEVEL_LABELS[c.candidate_level]}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center align-top">
                  {c.confidence ? (
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-1 text-xs capitalize",
                        c.confidence === "low" && "bg-amber-50 text-amber-700",
                        c.confidence === "medium" && "bg-blue-50 text-blue-700",
                        c.confidence === "high" && "bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {c.confidence}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center align-top">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Match: {matchCount}</span>
        <span>Exceeds: {exceedCount}</span>
        <span>Gap: {gapCount}</span>
        <span>Not assessed: {notAssessedCount}</span>
        {lowConfidenceCount > 0 && <span>Low confidence: {lowConfidenceCount}</span>}
        {overrideCount > 0 && <span>Human overrides: {overrideCount}</span>}
      </div>
    </div>
  );
}
