import { Badge } from "@/components/ui/badge";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleAlert, Minus, Pencil, Sparkles } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const resultStyles = {
  match: "border-primary/20 bg-primary/10 text-primary",
  gap: "border-secondary/60 bg-secondary/15 text-secondary-foreground",
  exceed: "border-blue-200 bg-blue-50 text-blue-700",
  not_assessed: "border-border bg-muted text-muted-foreground",
};

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const Icon =
    comparison.result === "match"
      ? CheckCircle2
      : comparison.result === "gap"
        ? CircleAlert
        : comparison.result === "exceed"
          ? Sparkles
          : Minus;
  const delta =
    comparison.delta && comparison.result === "exceed"
      ? ` +${comparison.delta}`
      : comparison.delta && comparison.result === "gap"
        ? ` -${Math.abs(comparison.delta)}`
        : "";

  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full px-2.5 py-1", resultStyles[comparison.result])}>
      <Icon className="h-3.5 w-3.5" />
      {FIT_GAP_RESULT_LABELS[comparison.result]}{delta}
    </Badge>
  );
}

function LevelValue({ label, level, muted = false }: { label: string; level: number | null; muted?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold", muted && "text-muted-foreground")}>
        {level != null ? LEVEL_LABELS[level] : "—"}
      </p>
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="space-y-5">
      <div className="hidden overflow-hidden rounded-xl border border-border/80 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/45">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Skill</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Required</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Candidate</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((comparison, index) => (
              <tr key={`${comparison.skill_id ?? comparison.skill_label}-${index}`} className="border-b last:border-0">
                <td className="px-4 py-4 font-medium">{comparison.skill_label}</td>
                <td className="px-4 py-4 text-center text-muted-foreground">{LEVEL_LABELS[comparison.required_level]}</td>
                <td className="px-4 py-4 text-center">
                  {comparison.candidate_level != null ? LEVEL_LABELS[comparison.candidate_level] : <span className="text-muted-foreground">—</span>}
                  {comparison.is_override && <Pencil className="ml-1 inline h-3 w-3 text-primary" aria-label="Human override applied" />}
                </td>
                <td className="px-4 py-4 text-center"><ResultBadge comparison={comparison} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {comparisons.map((comparison, index) => (
          <article key={`${comparison.skill_id ?? comparison.skill_label}-${index}`} className="rounded-xl border border-border/80 bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold leading-snug">{comparison.skill_label}</h3>
                {comparison.is_override && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary"><Pencil className="h-3 w-3" /> Human override applied</p>
                )}
              </div>
              <ResultBadge comparison={comparison} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-3">
              <LevelValue label="Required" level={comparison.required_level} />
              <LevelValue label="Candidate" level={comparison.candidate_level} muted={comparison.candidate_level == null} />
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {matchCount > 0 && <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />Match: {matchCount}</span>}
        {gapCount > 0 && <span className="inline-flex items-center gap-1.5"><CircleAlert className="h-3.5 w-3.5 text-secondary-foreground" />Gap: {gapCount}</span>}
        {exceedCount > 0 && <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-blue-600" />Exceeds: {exceedCount}</span>}
        {notAssessedCount > 0 && <span className="inline-flex items-center gap-1.5"><Minus className="h-3.5 w-3.5" />Not assessed: {notAssessedCount}</span>}
      </div>
    </div>
  );
}
