import {
  LEVEL_LABELS,
  LEVEL_DESCRIPTIONS,
  LEVEL_BADGE_CLASSES,
  FIT_GAP_RESULT_LABELS,
  FIT_GAP_RESULT_CLASSES,
} from "@/utils/constants";
import { CheckCircle2, TrendingUp, AlertTriangle, Minus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;

  let suffix = "";
  let semanticClasses = "";

  if (comparison.result === "match") {
    semanticClasses = "border-emerald-200 bg-emerald-50 text-emerald-800";
  } else if (comparison.result === "exceed") {
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
    semanticClasses = "border-[#0F8F95]/30 bg-[#0F8F95]/10 text-[#0B7479]";
  } else if (comparison.result === "gap") {
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
    semanticClasses = "border-amber-300 bg-amber-50 text-amber-900";
  } else {
    semanticClasses =
      "border-dashed border-slate-300 bg-slate-100/80 text-slate-600 font-medium";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border whitespace-nowrap",
        FIT_GAP_RESULT_CLASSES[comparison.result],
        semanticClasses
      )}
    >
      {comparison.result === "match" && (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
      )}
      {comparison.result === "exceed" && (
        <TrendingUp className="h-3.5 w-3.5 text-[#0F8F95] shrink-0" aria-hidden="true" />
      )}
      {comparison.result === "gap" && (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
      )}
      {comparison.result === "not_assessed" && (
        <Minus className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
      )}
      <span>
        {label}
        {suffix}
      </span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter(
    (c) => c.result === "not_assessed"
  ).length;

  if (comparisons.length === 0) {
    return (
      <p className="text-sm text-[#64748B] py-6 text-center border border-dashed border-[#E2E8F0] rounded-lg">
        No vacancy skills configured for comparison.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact, wrapping summary counts row */}
      <div
        aria-label="Fit/gap comparison summary"
        className="flex flex-wrap items-center gap-2"
      >
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-medium text-emerald-900">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>
            Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[#0F8F95]/30 bg-[#0F8F95]/10 px-2.5 py-1 text-xs font-medium text-[#0B7479]">
          <TrendingUp className="h-3.5 w-3.5 text-[#0F8F95] shrink-0" aria-hidden="true" />
          <span>
            Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50/80 px-2.5 py-1 text-xs font-medium text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
          <span>
            Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
          <Minus className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
          <span>
            Not assessed: {notAssessedCount} skill{notAssessedCount !== 1 ? "s" : ""}
          </span>
        </span>
      </div>

      {/* Contained Responsive Table Region */}
      <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F7F9FA] text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              <th scope="col" className="text-left px-4 py-3 font-semibold">
                Skill &amp; Provenance
              </th>
              <th scope="col" className="text-center px-3 sm:px-4 py-3 font-semibold w-28 sm:w-36">
                Required
              </th>
              <th scope="col" className="text-center px-3 sm:px-4 py-3 font-semibold w-32 sm:w-44">
                Candidate
              </th>
              <th scope="col" className="text-center px-3 sm:px-4 py-3 font-semibold w-32 sm:w-36">
                Outcome
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {comparisons.map((c, i) => {
              const reqLevel = c.required_level ?? c.expected_level;
              const isNotAssessed = c.result === "not_assessed" || c.candidate_level == null;
              const isInsufficient =
                c.assessment_status === "insufficient_evidence";
              const isLowConfidence =
                !c.is_override && c.confidence?.toLowerCase() === "low";
              const isPartial =
                !c.is_override && c.assessment_status === "partial";

              return (
                <tr
                  key={c.skill_id ?? `${c.skill_label}-${i}`}
                  className={cn(
                    "align-middle transition-colors hover:bg-[#F7F9FA]/70",
                    isNotAssessed && "bg-[#F7F9FA]/50"
                  )}
                >
                  <td className="px-4 py-3.5 text-left min-w-[200px]">
                    <div className="font-semibold text-[#1F2937] break-words">
                      {c.skill_label}
                    </div>
                    {c.is_override && c.assessor_notes && (
                      <div className="mt-1.5 rounded-md border border-[#0F8F95]/30 bg-[#0F8F95]/[0.05] px-2.5 py-1.5 text-xs text-[#1F2937] break-words leading-relaxed">
                        <span className="font-semibold text-[#0B7479]">
                          Override note:
                        </span>{" "}
                        {c.assessor_notes}
                      </div>
                    )}
                    {!c.is_override && (isLowConfidence || isPartial) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {isLowConfidence && (
                          <span className="inline-flex items-center text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            Low AI confidence
                          </span>
                        )}
                        {isPartial && (
                          <span className="inline-flex items-center text-[11px] text-[#64748B] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            Partial coverage
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-3 sm:px-4 py-3.5 text-center whitespace-nowrap">
                    {reqLevel != null ? (
                      <div className="inline-flex flex-col items-center">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center rounded-md px-2.5 py-0.5 text-xs font-semibold border",
                            LEVEL_BADGE_CLASSES[reqLevel] ?? "bg-slate-100 text-slate-700 border-slate-200"
                          )}
                        >
                          {LEVEL_LABELS[reqLevel] ?? `L${reqLevel}`}
                        </span>
                        {LEVEL_DESCRIPTIONS[reqLevel] && (
                          <span className="hidden sm:inline text-[11px] text-[#64748B] mt-0.5">
                            {LEVEL_DESCRIPTIONS[reqLevel]}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#64748B]">—</span>
                    )}
                  </td>

                  <td className="px-3 sm:px-4 py-3.5 text-center whitespace-nowrap">
                    {c.candidate_level != null ? (
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center rounded-md px-2.5 py-0.5 text-xs font-semibold border",
                              LEVEL_BADGE_CLASSES[c.candidate_level] ?? "bg-slate-100 text-slate-700 border-slate-200"
                            )}
                          >
                            {LEVEL_LABELS[c.candidate_level] ?? `L${c.candidate_level}`}
                          </span>
                          {c.is_override && (
                            <span
                              title="Assessor override applied"
                              aria-label="Assessor override applied"
                              className="inline-flex items-center text-[#0F8F95]"
                            >
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        {c.is_override && c.ai_level != null ? (
                          <span className="text-[11px] font-medium text-[#0B7479]">
                            AI {LEVEL_LABELS[c.ai_level] ?? `L${c.ai_level}`} →{" "}
                            {LEVEL_LABELS[c.candidate_level] ?? `L${c.candidate_level}`}
                          </span>
                        ) : (
                          LEVEL_DESCRIPTIONS[c.candidate_level] && (
                            <span className="hidden sm:inline text-[11px] text-[#64748B] mt-0.5">
                              {LEVEL_DESCRIPTIONS[c.candidate_level]}
                            </span>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="inline-flex flex-col items-center">
                        <span className="inline-flex items-center rounded-md border border-dashed border-slate-300 bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-700">
                          Not assessed
                        </span>
                        <span className="text-[11px] text-[#64748B] mt-0.5">
                          {isInsufficient ? "Insufficient evidence" : "Not probed"}
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="px-3 sm:px-4 py-3.5 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] px-1">
        <span>
          Unassessed skills lacked sufficient interview turns (0–1 probes) and are not counted as skill gaps.
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-[#0B7479]">
          <Pencil className="h-3 w-3 text-[#0F8F95]" aria-hidden="true" /> Human override applied
        </span>
      </div>
    </div>
  );
}


