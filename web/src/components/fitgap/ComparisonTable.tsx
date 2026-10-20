import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { CheckCircle2, Sparkles, AlertTriangle, Minus, Pencil } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const formatLevel = (level?: number | string | null): string => {
  if (level == null || level === "" || level === "undefined") return "-";
  const num = typeof level === "number" ? level : parseInt(String(level).replace(/\D/g, ""), 10);
  if (isNaN(num)) return "-";
  return LEVEL_LABELS[num] || (num ? `L${num}` : "-");
};

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] || comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] || "text-neutral-500 bg-neutral-50";

  const suffix = comparison.delta
    ? comparison.delta > 0
      ? ` +${comparison.delta}`
      : ` -${Math.abs(comparison.delta)}`
    : "";

  const renderIcon = () => {
    switch (comparison.result) {
      case "match":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />;
      case "exceed":
        return <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />;
      case "gap":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />;
      default:
        return <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border border-transparent", classes)}>
      {renderIcon()}
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
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-800">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {formatLevel(c.required_level)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null && formatLevel(c.candidate_level) !== "-" ? (
                    <span className="inline-flex items-center gap-1.5 justify-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {formatLevel(c.candidate_level)}
                      </span>
                      {c.is_override && (
                        <Pencil className="h-3 w-3 text-muted-foreground shrink-0" title="Human override applied" />
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
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
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
            <span>Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}</span>
          </span>
        )}
        {gapCount > 0 && (
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}</span>
          </span>
        )}
        {exceedCount > 0 && (
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
          <span>Human override applied</span>
        </span>
      </div>
    </div>
  );
}
