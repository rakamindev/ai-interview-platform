import { AlertTriangle, CheckCircle2, Minus, Pencil, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIT_GAP_RESULT_CLASSES, FIT_GAP_RESULT_LABELS, LEVEL_LABELS } from "@/utils/constants";
import { summarizeComparisons } from "@/utils/fitGap";
import type { SkillComparison, SkillComparisonResult } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const resultIcons: Record<SkillComparisonResult, typeof CheckCircle2> = {
  match: CheckCircle2,
  gap: AlertTriangle,
  exceed: Star,
  not_assessed: Minus,
};

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const Icon = resultIcons[comparison.result];
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const suffix =
    comparison.result === "exceed" && comparison.delta
      ? ` +${comparison.delta}`
      : comparison.result === "gap" && comparison.delta
        ? ` -${Math.abs(comparison.delta)}`
        : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        FIT_GAP_RESULT_CLASSES[comparison.result],
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
      {suffix}
    </span>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className={cn("text-lg font-bold", tone)}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const summary = summarizeComparisons(comparisons);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryStat label="Positive rate" value={summary.positiveRate == null ? "—" : `${summary.positiveRate}%`} tone="text-indigo-700" />
        <SummaryStat label="Assessed" value={summary.assessed} tone="text-slate-950" />
        <SummaryStat label="Matches" value={summary.matches} tone="text-emerald-700" />
        <SummaryStat label="Gaps" value={summary.gaps} tone="text-amber-700" />
        <SummaryStat label="Not assessed" value={summary.notAssessed} tone="text-slate-500" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[650px] text-sm">
          <caption className="sr-only">Fit and gap comparison by skill</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th scope="col" className="px-4 py-3 font-semibold text-slate-700">Skill</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold text-slate-700">Required</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold text-slate-700">Candidate</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold text-slate-700">Result</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold text-slate-700">Evidence state</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((comparison, index) => (
              <tr key={`${comparison.skill_id ?? comparison.skill_label}-${index}`} className="border-b border-slate-100 last:border-0">
                <th scope="row" className="max-w-[260px] break-words px-4 py-3 text-left font-medium text-slate-900">
                  {comparison.skill_label}
                </th>
                <td className="px-4 py-3 text-center text-slate-600">
                  {comparison.required_level == null ? "—" : LEVEL_LABELS[comparison.required_level] ?? `L${comparison.required_level}`}
                </td>
                <td className="px-4 py-3 text-center">
                  {comparison.candidate_level == null ? (
                    <span className="text-slate-400">Not assessed</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                      {LEVEL_LABELS[comparison.candidate_level] ?? `L${comparison.candidate_level}`}
                      {comparison.is_override && (
                        <span title="Assessor override applied" className="inline-flex items-center gap-1 text-xs text-indigo-700">
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          human
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <ResultBadge comparison={comparison} />
                </td>
                <td className="px-4 py-3 text-center text-xs text-slate-500">
                  {comparison.rating_status === "not_assessed" ? "No rating" : comparison.confidence ?? "Recorded"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span>{summary.total} skill{summary.total === 1 ? "" : "s"} compared</span>
        <span className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" aria-hidden="true" /> Human override applied</span>
        {summary.exceeds > 0 && <span className="text-emerald-700">{summary.exceeds} exceeds requirement</span>}
      </div>
    </div>
  );
}
