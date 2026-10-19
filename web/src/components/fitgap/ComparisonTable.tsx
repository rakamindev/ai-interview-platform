import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { requiredLevel, type ComparisonInput } from "@/features/hiring/decision";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function levelLabel(level: number | null | undefined): string {
  if (level == null) return "—";
  return LEVEL_LABELS[level] ?? "—";
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result] ?? "text-neutral-600 bg-neutral-50";
  const delta = comparison.delta;
  let suffix = "";
  if (comparison.result === "exceed" && typeof delta === "number" && delta !== 0) suffix = ` +${delta}`;
  if (comparison.result === "gap" && typeof delta === "number") suffix = ` ${delta}`;

  return (
    <span className={cn("inline-flex items-center text-xs font-medium px-2 py-0.5 rounded", classes)}>
      {label}{suffix}
    </span>
  );
}

function confidenceLabel(value?: string | null): string {
  if (!value) return "—";
  return value.toLowerCase();
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (comparisons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground text-center">
        This vacancy has no skills to compare. Add a required level before making a hiring decision.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium">Skill</th>
              <th className="text-left px-4 py-2.5 font-medium">Required</th>
              <th className="text-left px-4 py-2.5 font-medium">Candidate</th>
              <th className="text-left px-4 py-2.5 font-medium">Confidence</th>
              <th className="text-left px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((comparison, index) => (
              <tr key={`${comparison.skill_label}-${index}`} className="border-b last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="break-words">{comparison.skill_label || "Untitled skill"}</p>
                  {comparison.is_override && <p className="text-[11px] text-muted-foreground">Human override applied</p>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{levelLabel(requiredLevel(comparison as ComparisonInput))}</td>
                <td className="px-4 py-3">{levelLabel(comparison.candidate_level)}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{confidenceLabel(comparison.confidence)}</td>
                <td className="px-4 py-3"><ResultBadge comparison={comparison} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-2">
        {comparisons.map((comparison, index) => (
          <li key={`${comparison.skill_label}-${index}`} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium break-words">{comparison.skill_label || "Untitled skill"}</p>
              <ResultBadge comparison={comparison} />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Required</dt>
                <dd>{levelLabel(requiredLevel(comparison as ComparisonInput))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Candidate</dt>
                <dd>{levelLabel(comparison.candidate_level)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Confidence</dt>
                <dd className="capitalize">{confidenceLabel(comparison.confidence)}</dd>
              </div>
            </dl>
            {comparison.is_override && <p className="text-[11px] text-muted-foreground">Human override applied</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
