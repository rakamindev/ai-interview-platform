import { CheckCircle2, Minus, TrendingUp, TriangleAlert } from "lucide-react";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison, SkillComparisonResult } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? "Unknown";
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "bg-muted text-muted-foreground";
  const suffix = comparison.delta
    ? comparison.result === "exceed"
      ? ` +${comparison.delta}`
      : comparison.result === "gap"
        ? ` -${Math.abs(comparison.delta)}`
        : ""
    : "";

  const Icon = comparison.result === "match"
    ? CheckCircle2
    : comparison.result === "exceed"
      ? TrendingUp
      : comparison.result === "gap"
        ? TriangleAlert
        : Minus;

  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium", classes)}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span>{label}{suffix}</span>
    </span>
  );
}

function Confidence({ value }: { value: SkillComparison["confidence"] }) {
  if (!value) return <span className="text-muted-foreground">Not available</span>;
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          value === "high" ? "bg-emerald-600" : value === "medium" ? "bg-amber-500" : "bg-muted-foreground"
        )}
      />
      {label}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const count = (result: SkillComparisonResult) =>
    comparisons.filter((item) => item.result === result).length;

  if (comparisons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium">No skill requirements to compare</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add skills to the vacancy and regenerate this report to see a comparison.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Fit-gap summary">
        {([
          ["Match", count("match"), "text-emerald-700"],
          ["Gap", count("gap"), "text-amber-700"],
          ["Exceeds", count("exceed"), "text-emerald-700"],
          ["Not assessed", count("not_assessed"), "text-muted-foreground"],
        ] as const).map(([label, value, color]) => (
          <div key={label} className="rounded-lg border bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[680px] text-sm">
          <caption className="sr-only">Candidate skills compared with vacancy requirements</caption>
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-4 py-3 text-left font-medium">Skill</th>
              <th scope="col" className="px-4 py-3 text-center font-medium">Required</th>
              <th scope="col" className="px-4 py-3 text-center font-medium">Candidate</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">Confidence</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((comparison, index) => (
              <tr
                key={(comparison.skill_id ?? comparison.skill_label) + "-" + index}
                className="border-b last:border-0 hover:bg-muted/20"
              >
                <th scope="row" className="max-w-[280px] px-4 py-3 text-left font-medium">
                  <span className="break-words">{comparison.skill_label}</span>
                  {comparison.is_override && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-normal text-sky-700">
                      <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                      Assessor override applied
                    </span>
                  )}
                </th>
                <td className="px-4 py-3 text-center text-muted-foreground">
                  {LEVEL_LABELS[comparison.required_level] ?? "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {comparison.candidate_level != null
                    ? (LEVEL_LABELS[comparison.candidate_level] ?? "—")
                    : <span className="text-muted-foreground">Not assessed</span>}
                </td>
                <td className="px-4 py-3"><Confidence value={comparison.confidence} /></td>
                <td className="px-4 py-3"><ResultBadge comparison={comparison} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Confidence describes the available assessment evidence, not the probability that a hiring decision is correct.
      </p>
    </div>
  );
}
