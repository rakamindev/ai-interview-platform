import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Minus, Pencil, TrendingUp, type LucideIcon } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const RESULT_ICONS: Record<string, LucideIcon> = {
  match: Check,
  exceed: TrendingUp,
  gap: AlertTriangle,
  not_assessed: Minus,
};

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];
  const Icon = RESULT_ICONS[comparison.result] ?? Minus;
  let suffix = "";
  if (comparison.result === "exceed" && comparison.delta) suffix = ` +${comparison.delta}`;
  else if (comparison.result === "gap" && comparison.delta)
    suffix = ` -${Math.abs(comparison.delta)}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        classes,
      )}
    >
      <Icon className="h-3 w-3" /> {label}
      {suffix}
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
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-rakamin-light-cyan/60 text-rakamin-dark-teal">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.required_level]}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && (
                        <Pencil
                          className="ml-1 inline h-3 w-3 text-muted-foreground"
                          aria-label="human override applied"
                        />
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3" /> Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Exceeds: {exceedCount} skill
            {exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="flex items-center gap-1 sm:ml-auto">
          <Pencil className="h-3 w-3" /> = human override applied
        </span>
      </div>
    </div>
  );
}
