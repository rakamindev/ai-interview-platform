import { LEVEL_LABELS, LEVEL_DESCRIPTIONS, parseLevel } from "@/utils/constants";
import { CheckCircle2, AlertTriangle, TrendingUp, HelpCircle, ShieldCheck } from "lucide-react";
import LevelBadge from "@/components/portfolio/LevelBadge";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result === "match") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        Match
      </span>
    );
  }

  if (comparison.result === "exceed") {
    const deltaStr = comparison.delta ? `+${comparison.delta}` : "";
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        Exceeds {deltaStr && <span className="font-bold text-emerald-800">({deltaStr})</span>}
      </span>
    );
  }

  if (comparison.result === "gap") {
    const deltaStr = comparison.delta ? `-${Math.abs(comparison.delta)}` : "";
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        Gap {deltaStr && <span className="font-bold text-amber-900">({deltaStr})</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500">
      <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      Not assessed
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="">
              <th className="text-left px-4 py-3 font-semibold text-xs text-slate-700 uppercase tracking-wider">Required Competency</th>
              <th className="text-center px-4 py-3 font-semibold text-xs text-slate-700 uppercase tracking-wider">Target Level</th>
              <th className="text-center px-4 py-3 font-semibold text-xs text-slate-700 uppercase tracking-wider">Candidate Demonstrated</th>
              <th className="text-center px-4 py-3 font-semibold text-xs text-slate-700 uppercase tracking-wider">Benchmark Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparisons.map((c, i) => {
              const reqLevel = parseLevel((c as any).expected_level ?? c.required_level ?? 1);
              const candLevel = c.candidate_level != null ? parseLevel(c.candidate_level) : null;
              return (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-slate-900">
                    <div className="flex flex-col">
                      <span>{c.skill_label}</span>
                      <span className="text-[11px] text-slate-400">
                        Baseline Expectation: {LEVEL_LABELS[reqLevel]} ({LEVEL_DESCRIPTIONS[reqLevel]})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <LevelBadge level={reqLevel} size="sm" />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {candLevel != null ? (
                      <div className="inline-flex flex-col items-center gap-1">
                        <LevelBadge level={candLevel} size="sm" />
                        {c.is_override && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            Assessor Overridden
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not evaluated</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
            <CheckCircle2 className="h-3.5 w-3.5" /> Matches: {matchCount}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
            <TrendingUp className="h-3.5 w-3.5" /> Exceeds: {exceedCount}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Gaps: {gapCount}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[12px] text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Indicates certified human assessor override</span>
        </div>
      </div>
    </div>
  );
}
