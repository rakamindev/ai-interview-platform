import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";
import { CheckCircle2, TrendingUp, AlertTriangle, HelpCircle, UserCheck, Sparkles } from "lucide-react";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const result = comparison.result || "not_assessed";
  const label = FIT_GAP_RESULT_LABELS[result] || result;
  const classes = FIT_GAP_RESULT_CLASSES[result] || "text-slate-600 bg-slate-100 border border-slate-200";

  let icon = null;
  let suffix = "";

  if (result === "match") {
    icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
  } else if (result === "exceed") {
    icon = <TrendingUp className="h-3.5 w-3.5 text-sky-600 shrink-0" />;
    suffix = comparison.delta ? ` (+${comparison.delta})` : "";
  } else if (result === "gap") {
    icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />;
    suffix = comparison.delta ? ` (${comparison.delta})` : "";
  } else if (result === "not_assessed") {
    icon = <HelpCircle className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full shadow-xs transition-colors whitespace-nowrap shrink-0",
        classes
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{label}{suffix}</span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary metrics
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;
  const totalCount = comparisons.length;
  const benchmarkRate = totalCount > 0 ? Math.round(((matchCount + exceedCount) / totalCount) * 100) : 0;
  const matchPct = totalCount > 0 ? Math.round((matchCount / totalCount) * 100) : 0;
  const exceedPct = totalCount > 0 ? Math.round((exceedCount / totalCount) * 100) : 0;
  const gapPct = totalCount > 0 ? Math.round((gapCount / totalCount) * 100) : 0;
  const notAssessedPct = totalCount > 0 ? Math.round((notAssessedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Visual Alignment Score Meter */}
      <div className="p-4 rounded-xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-[#01959f] shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Overall Benchmark Alignment
            </span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-[#01959f] self-start sm:self-auto bg-teal-50 sm:bg-transparent px-2 sm:px-0 py-0.5 rounded-md border sm:border-0 border-teal-200/60">
            {benchmarkRate}% Met or Exceeded
          </span>
        </div>

        {/* Multi-segment breakdown bar */}
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex shadow-inner">
          {matchCount > 0 && (
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${(matchCount / totalCount) * 100}%` }}
              title={`Matches: ${matchCount} (${matchPct}%)`}
            />
          )}
          {exceedCount > 0 && (
            <div
              className="bg-sky-500 h-full transition-all duration-500"
              style={{ width: `${(exceedCount / totalCount) * 100}%` }}
              title={`Exceeds: ${exceedCount} (${exceedPct}%)`}
            />
          )}
          {gapCount > 0 && (
            <div
              className="bg-amber-400 h-full transition-all duration-500"
              style={{ width: `${(gapCount / totalCount) * 100}%` }}
              title={`Gaps: ${gapCount} (${gapPct}%)`}
            />
          )}
          {notAssessedCount > 0 && (
            <div
              className="bg-slate-300 h-full transition-all duration-500"
              style={{ width: `${(notAssessedCount / totalCount) * 100}%` }}
              title={`Not Evaluated: ${notAssessedCount} (${notAssessedPct}%)`}
            />
          )}
        </div>

        {/* Detailed Legend with counts and percentages */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs pt-0.5 text-slate-600">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Match: <strong>{matchCount}</strong> ({matchPct}%)</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
            <span>Exceed: <strong>{exceedCount}</strong> ({exceedPct}%)</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
            <span>Gap: <strong>{gapCount}</strong> ({gapPct}%)</span>
          </div>
          {notAssessedCount > 0 && (
            <div className="flex items-center gap-1.5 font-medium text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
              <span>Belum Dinilai: <strong>{notAssessedCount}</strong> ({notAssessedPct}%)</span>
            </div>
          )}
        </div>
      </div>

      {/* Executive Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-lg border bg-emerald-50/50 border-emerald-200/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-800">
            <span>Matches</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-950">
            {matchCount}
            <span className="text-xs font-normal text-emerald-700/80 ml-1">
              / {totalCount}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg border bg-sky-50/50 border-sky-200/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-sky-800">
            <span>Exceeds</span>
            <TrendingUp className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-sky-950">
            {exceedCount}
          </div>
        </div>

        <div className="p-3 rounded-lg border bg-amber-50/50 border-amber-200/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-amber-800">
            <span>Gaps</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-950">
            {gapCount}
          </div>
        </div>

        <div className="p-3 rounded-lg border bg-slate-50/80 border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span>Not Evaluated</span>
            <HelpCircle className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-800">
            {notAssessedCount}
          </div>
        </div>
      </div>

      {/* Comparison Data Table */}
      <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-semibold">Skill Requirement</th>
              <th className="text-center px-4 py-3 font-semibold w-24">Required</th>
              <th className="text-center px-4 py-3 font-semibold w-28">Candidate</th>
              <th className="text-center px-4 py-3 font-semibold w-36">Assessment Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {comparisons.map((c, i) => {
              const reqLevel = c.required_level ?? (c as any).expected_level;
              const hasCandidateLevel = c.candidate_level != null;

              return (
                <tr
                  key={c.skill_label || i}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {c.skill_label}
                    </div>
                    {c.result === "not_assessed" && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Skill not probed during AI session
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap shrink-0">
                      {LEVEL_LABELS[reqLevel] || (reqLevel ? `L${reqLevel}` : "—")}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center">
                    {hasCandidateLevel ? (
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-semibold whitespace-nowrap shrink-0">
                          {LEVEL_LABELS[c.candidate_level!] || `L${c.candidate_level}`}
                        </span>
                        {c.is_override && (
                          <span
                            title="Human assessor override applied"
                            className="inline-flex items-center text-xs text-amber-600"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Not Evaluated
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footnote / Context */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-3">
          {notAssessedCount > 0 && (
            <span className="text-slate-600 flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
              {notAssessedCount} skill{notAssessedCount !== 1 ? "s" : ""} require follow-up evaluation.
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/50">
          <UserCheck className="h-3.5 w-3.5" />
          <span>Assessor overrides take precedence over AI scoring</span>
        </div>
      </div>
    </div>
  );
}
