import { useState, useMemo } from "react";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { CheckCircle2, Star, AlertTriangle, HelpCircle, Pencil } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const result = comparison.result;
  const label = FIT_GAP_RESULT_LABELS[result] || result;
  const classes = FIT_GAP_RESULT_CLASSES[result] || "text-neutral-600 bg-neutral-100";

  let Icon = HelpCircle;
  let suffix = "";

  if (result === "match") {
    Icon = CheckCircle2;
  } else if (result === "exceed") {
    Icon = Star;
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (result === "gap") {
    Icon = AlertTriangle;
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shadow-2xs",
        classes
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{label}{suffix}</span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const [filter, setFilter] = useState<"all" | "match" | "gap" | "exceed" | "not_assessed">("all");

  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  const filteredComparisons = useMemo(() => {
    if (filter === "all") return comparisons;
    return comparisons.filter((c) => c.result === filter);
  }, [comparisons, filter]);

  return (
    <div className="space-y-4">
      {/* Quick summary stats chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
            filter === "all" ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "bg-card text-muted-foreground hover:bg-accent"
          )}
        >
          All ({comparisons.length})
        </button>

        {matchCount > 0 && (
          <button
            onClick={() => setFilter("match")}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
              filter === "match" ? "bg-emerald-600 text-white font-semibold shadow-xs" : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            Match ({matchCount})
          </button>
        )}

        {gapCount > 0 && (
          <button
            onClick={() => setFilter("gap")}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
              filter === "gap" ? "bg-amber-600 text-white font-semibold shadow-xs" : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            Gap ({gapCount})
          </button>
        )}

        {exceedCount > 0 && (
          <button
            onClick={() => setFilter("exceed")}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
              filter === "exceed" ? "bg-teal-600 text-white font-semibold shadow-xs" : "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100"
            )}
          >
            <Star className="h-3 w-3" />
            Exceeds ({exceedCount})
          </button>
        )}

        {notAssessedCount > 0 && (
          <button
            onClick={() => setFilter("not_assessed")}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
              filter === "not_assessed" ? "bg-neutral-700 text-white font-semibold shadow-xs" : "bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200"
            )}
          >
            <HelpCircle className="h-3 w-3" />
            Unassessed ({notAssessedCount})
          </button>
        )}
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto rounded-xl border border-border/80 shadow-2xs">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-muted-foreground">
              <th className="text-left px-4 py-3 font-semibold">Evaluated Competency</th>
              <th className="text-center px-4 py-3 font-semibold w-24">Required</th>
              <th className="text-center px-4 py-3 font-semibold w-28">Candidate</th>
              <th className="text-center px-4 py-3 font-semibold w-36">Fit Assessment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredComparisons.map((c, i) => {
              const reqLevel = c.required_level ?? (c as any).expected_level;

              return (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-foreground">
                    <div className="break-words max-w-xs sm:max-w-md">
                      {c.skill_label}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center text-muted-foreground font-mono font-semibold">
                    {reqLevel != null ? LEVEL_LABELS[reqLevel] || `L${reqLevel}` : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {c.candidate_level != null ? (
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-foreground">
                        {LEVEL_LABELS[c.candidate_level] || `L${c.candidate_level}`}
                        {c.is_override && (
                          <span title="Overridden by assessor" className="text-purple-600">
                            <Pencil className="h-3 w-3" />
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-500 border border-neutral-200">
                        Not evaluated
                      </span>
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

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span>Showing {filteredComparisons.length} of {comparisons.length} comparisons</span>
        <span className="flex items-center gap-1">
          <Pencil className="h-3 w-3 text-purple-600" /> Human assessor override applied
        </span>
      </div>
    </div>
  );
}
