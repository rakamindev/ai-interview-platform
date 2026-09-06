import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { CheckCircle2, Sparkles, AlertTriangle, PenLine, Minus } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  const suffix = comparison.delta
    ? comparison.delta > 0
      ? ` +${comparison.delta}`
      : ` -${Math.abs(comparison.delta)}`
    : "";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded shadow-2xs", classes)}>
      {comparison.result === "match" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
      {comparison.result === "exceed" && <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
      {comparison.result === "gap" && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
      {comparison.result === "not_assessed" && <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      <span>{label}{suffix}</span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {comparisons.map((c, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-medium text-foreground">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground font-mono text-xs">
                  {LEVEL_LABELS[c.required_level]}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && (
                        <span title="Human override applied" className="text-muted-foreground/80 hover:text-foreground inline-flex items-center">
                          <PenLine className="h-3 w-3" />
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        {matchCount > 0 && (
          <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded px-2 py-0.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span className="flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200/60 rounded px-2 py-0.5">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-2 py-0.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/70">
          <PenLine className="h-3 w-3" /> human override applied
        </span>
      </div>
    </div>
  );
}
