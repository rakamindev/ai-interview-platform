import { AlertTriangle, Check, HelpCircle, Pencil, Star } from "lucide-react";
import { FIT_GAP_RESULT_CLASSES, FIT_GAP_RESULT_LABELS, LEVEL_DESCRIPTIONS, LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { formatDelta, normalizeComparison, sortComparisons } from "@/lib/fitgap";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const RESULT_ICON = {
  match: Check,
  exceed: Star,
  gap: AlertTriangle,
  not_assessed: HelpCircle,
} as const;

function Level({ level }: { level?: number | null }) {
  if (level == null || !LEVEL_LABELS[level]) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      <span className="font-medium">{LEVEL_LABELS[level]}</span>
      <span className="ml-1 hidden text-xs text-muted-foreground lg:inline">{LEVEL_DESCRIPTIONS[level]}</span>
    </span>
  );
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const Icon = RESULT_ICON[comparison.result];
  const verify = comparison.result === "gap" && comparison.low_evidence;
  const label = verify ? "Gap · verify" : FIT_GAP_RESULT_LABELS[comparison.result];
  const delta =
    comparison.result === "gap" || comparison.result === "exceed" ? ` ${formatDelta(comparison.delta)}` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
        FIT_GAP_RESULT_CLASSES[comparison.result],
        verify && "border border-dashed border-amber-400"
      )}
      title={
        comparison.result === "not_assessed"
          ? "This skill was not covered in the interview. That is unknown, not a weakness."
          : verify
            ? "Low-confidence rating: the interview only touched this skill lightly. Verify before relying on it."
            : undefined
      }
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
      {delta}
    </span>
  );
}

/** One row per required skill: gaps and unknowns first. Stacks on narrow screens, grid from md up. */
export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const rows = sortComparisons(comparisons.map(normalizeComparison));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        This vacancy lists no required skills, so there is nothing to compare. Add skills to the vacancy to get a
        fit/gap comparison.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        aria-hidden
        className="hidden grid-cols-[minmax(0,1fr)_6rem_8rem_11rem] gap-3 border-b bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid"
      >
        <span>Skill</span>
        <span>Required</span>
        <span>Candidate</span>
        <span>Result</span>
      </div>
      <ul className="divide-y" aria-label="Skill comparison">
        {rows.map((c, i) => (
          <li
            key={`${c.skill_id ?? c.skill_label}-${i}`}
            className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_6rem_8rem_11rem]"
          >
            <span className="col-span-2 min-w-0 break-words font-medium md:col-span-1">{c.skill_label}</span>
            <span className="text-muted-foreground">
              <span className="mr-1 text-xs md:hidden">Required</span>
              <Level level={c.required_level} />
            </span>
            <span>
              <span className="mr-1 text-xs text-muted-foreground md:hidden">Candidate</span>
              <Level level={c.candidate_level} />
              {c.is_override && (
                <span
                  className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground"
                  title={c.ai_level ? `Adjusted by an assessor (AI said L${c.ai_level})` : "Adjusted by an assessor"}
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  <span className="sr-only">Adjusted by an assessor</span>
                </span>
              )}
            </span>
            <span className="col-span-2 md:col-span-1">
              <ResultBadge comparison={c} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
