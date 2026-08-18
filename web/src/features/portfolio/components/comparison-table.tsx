import { AlertTriangle, CheckCircle2, Minus, Pencil, Star } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import { FIT_GAP_RESULT_CLASSES, FIT_GAP_RESULT_LABELS, LEVEL_LABELS } from "@/utils/constants";

import type { SkillComparison } from "../schemas/fitgap";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultIcon({ result }: { result: SkillComparison["result"] }) {
  const icons: Record<SkillComparison["result"], ComponentType<{ className?: string }>> = {
    match: CheckCircle2,
    exceed: Star,
    gap: AlertTriangle,
    not_assessed: Minus,
  };
  const Icon = icons[result];
  return <Icon className="size-3.5 shrink-0" />;
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  let suffix = "";
  if (comparison.result === "exceed") {
    suffix = comparison.delta ? ` +${comparison.delta}` : "";
  } else if (comparison.result === "gap") {
    suffix = comparison.delta ? ` -${Math.abs(comparison.delta)}` : "";
  }

  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", classes)}>
      <ResultIcon result={comparison.result} />
      {label}
      {suffix}
    </span>
  );
}

export function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;

  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium">Skill</th>
              <th className="px-4 py-2.5 text-center font-medium">Required</th>
              <th className="px-4 py-2.5 text-center font-medium">Candidate</th>
              <th className="px-4 py-2.5 text-center font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2.5">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">{LEVEL_LABELS[c.expected_level]}</td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && <span className="ml-1 text-xs text-muted-foreground">✏</span>}
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

      <div className="space-y-2 md:hidden">
        {comparisons.map((c, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium">{c.skill_label}</span>
              <ResultBadge comparison={c} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>
                Required: <strong className="text-foreground">{LEVEL_LABELS[c.expected_level]}</strong>
              </span>
              <span>
                Candidate:{" "}
                <strong className="text-foreground">
                  {c.candidate_level != null ? LEVEL_LABELS[c.candidate_level] : "—"}
                  {c.is_override ? " · human" : ""}
                </strong>
              </span>
            </div>
            {c.caveat && <p className="text-xs text-muted-foreground">{c.caveat}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-success" />
            Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="size-3.5 text-warning" />
            Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 text-warning" />
            Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <Pencil className="size-3" />
          human override applied
        </span>
      </div>
    </div>
  );
}
