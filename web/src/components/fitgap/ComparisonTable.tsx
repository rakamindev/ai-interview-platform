import { LEVEL_LABELS, LEVEL_DESCRIPTIONS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Check, Minus, Pencil, Star, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const iconClasses = "h-3 w-3";

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? FIT_GAP_RESULT_CLASSES.not_assessed;

  let icon: ReactNode = <Minus aria-hidden className={iconClasses} />;
  let suffix = "";
  if (comparison.result === "match") icon = <Check aria-hidden className={iconClasses} />;
  else if (comparison.result === "exceed") { icon = <Star aria-hidden className={iconClasses} />; suffix = comparison.delta ? ` +${comparison.delta}` : ""; }
  else if (comparison.result === "gap") { icon = <TriangleAlert aria-hidden className={iconClasses} />; suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : ""; }

  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", classes)}>
      {icon}
      <span>{label}{suffix}</span>
    </Badge>
  );
}

function LevelCell({ level }: { level: number | null }) {
  if (level == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      title={LEVEL_DESCRIPTIONS[level] ?? `L${level}`}
      className="cursor-default border-b border-dotted border-muted-foreground/50"
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (comparisons.length === 0) {
    return (
      <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
        No skill comparisons are available for this vacancy.
      </div>
    );
  }

  // Summary counts
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

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
            {comparisons.map((c) => (
              <tr key={c.skill_label} className="border-b last:border-0">
                <td className="px-4 py-2.5 min-w-[8rem] break-words">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  <LevelCell level={c.required_level} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      <LevelCell level={c.candidate_level} />
                      {c.is_override && (
                        <Pencil aria-hidden className="h-3 w-3 text-muted-foreground inline ml-1" />
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Check aria-hidden className="h-3 w-3" /> Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <TriangleAlert aria-hidden className="h-3 w-3" /> Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star aria-hidden className="h-3 w-3" /> Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        {notAssessedCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Minus aria-hidden className="h-3 w-3" /> Not assessed: {notAssessedCount} skill{notAssessedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="inline-flex items-center gap-1 ml-auto">
          <Pencil aria-hidden className="h-3 w-3" /> <span className="sr-only">Pencil icon means </span>human override applied
        </span>
      </div>
    </div>
  );
}