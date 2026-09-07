import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Minus, Pencil, TrendingUp } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

// Emoji were doing the semantic work here: a screen reader announced "white
// heavy check mark" rather than "match", and the glyphs render inconsistently
// across the fonts installed on Windows. Icons from the design system carry the
// meaning visually and are hidden from assistive tech, so the word beside them
// is what gets announced.
const RESULT_ICON = {
  match: Check,
  exceed: TrendingUp,
  gap: AlertTriangle,
  not_assessed: Minus,
} as const;

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];
  const Icon = RESULT_ICON[comparison.result] ?? Minus;

  const delta = comparison.delta ?? 0;
  let suffix = "";
  if (comparison.result === "exceed" && delta) suffix = ` +${delta}`;
  if (comparison.result === "gap" && delta) suffix = ` −${Math.abs(delta)}`;

  // The level a skill was not assessed at is not zero, and a reader skimming a
  // column of badges should not have to infer that from a dash.
  const spoken =
    comparison.result === "not_assessed"
      ? "Not assessed — this skill was not covered in the interview"
      : `${label}${suffix}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
        classes
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true">
        {label}
        {suffix}
      </span>
    </span>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  // Summary counts. `not_assessed` is counted too: leaving it out meant a
  // three-skill role summarised as "Match: 1, Gap: 1" and the third skill
  // silently disappeared from the tally a hiring manager reads.
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
            {comparisons.map((c, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2.5">{c.skill_label}</td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">
                  {LEVEL_LABELS[c.expected_level] ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.candidate_level != null ? (
                    <span>
                      {LEVEL_LABELS[c.candidate_level]}
                      {c.is_override && (
                        <Pencil
                          className="ml-1 inline h-3 w-3 text-muted-foreground"
                          aria-label="Level set by an assessor"
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
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {matchCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Check className="h-3 w-3" aria-hidden="true" /> Match: {matchCount} skill{matchCount !== 1 ? "s" : ""}
          </span>
        )}
        {gapCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Gap: {gapCount} skill{gapCount !== 1 ? "s" : ""}
          </span>
        )}
        {exceedCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" aria-hidden="true" /> Exceeds: {exceedCount} skill{exceedCount !== 1 ? "s" : ""}
          </span>
        )}
        {notAssessedCount > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
            <Minus className="h-3 w-3" aria-hidden="true" /> Not assessed: {notAssessedCount} skill{notAssessedCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <Pencil className="h-3 w-3" aria-hidden="true" /> = human override applied
        </span>
      </div>
    </div>
  );
}
