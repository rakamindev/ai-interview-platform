import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { comparisonNeedsReview, notAssessedCopy, requiredLevel, summarizeComparisons } from "@/lib/portfolio";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Check, CircleDashed, Eye, UserCheck } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const RESULT_ICON = {
  match: Check,
  exceed: ArrowUp,
  gap: ArrowDown,
  not_assessed: CircleDashed,
} as const;

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const Icon = RESULT_ICON[comparison.result] ?? CircleDashed;
  const delta = comparison.delta;
  const suffix =
    comparison.result === "exceed" && delta ? ` +${delta}` : comparison.result === "gap" && delta ? ` ${delta}` : "";

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        FIT_GAP_RESULT_CLASSES[comparison.result]
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result}
      {suffix}
    </span>
  );

  if (comparison.result !== "not_assessed") return badge;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {badge}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-xs">{notAssessedCopy(comparison.not_assessed_reason).body}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Level({ value }: { value: number | null | undefined }) {
  return value != null && LEVEL_LABELS[value] ? (
    <span className="font-medium tabular-nums">{LEVEL_LABELS[value]}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

function Markers({ c }: { c: SkillComparison }) {
  return (
    <>
      {c.is_override && (
        <UserCheck className="ml-1 inline h-3.5 w-3.5 text-primary" aria-label="Rated by an assessor" />
      )}
      {comparisonNeedsReview(c) && c.result !== "not_assessed" && (
        <Eye className="ml-1 inline h-3.5 w-3.5 text-amber-600" aria-label="Low confidence — needs review" />
      )}
    </>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const counts = summarizeComparisons(comparisons);

  if (comparisons.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        This vacancy has no skill requirements to compare against.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Skill</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Required</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Candidate</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <tr key={`${c.skill_label}-${i}`} className={cn("border-b last:border-0", c.result === "not_assessed" && "bg-muted/20")}>
                <th scope="row" className="max-w-xs px-4 py-3 text-left font-normal break-words">
                  {c.skill_label}
                </th>
                <td className="px-4 py-3 text-center text-muted-foreground">
                  <Level value={requiredLevel(c)} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <Level value={c.candidate_level} />
                  <Markers c={c} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ResultBadge comparison={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-2 sm:hidden">
        {comparisons.map((c, i) => (
          <li key={`${c.skill_label}-${i}`} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm font-medium break-words">{c.skill_label}</span>
              <ResultBadge comparison={c} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Required <Level value={requiredLevel(c)} /> · Candidate <Level value={c.candidate_level} />
              <Markers c={c} />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{counts.match} match</span>
        <span>{counts.exceed} exceed</span>
        <span>{counts.gap} below required</span>
        {counts.notAssessed > 0 && <span className="font-medium text-foreground">{counts.notAssessed} not assessed</span>}
        <span className="flex items-center gap-3 sm:ml-auto">
          <span className="inline-flex items-center gap-1">
            <UserCheck className="h-3 w-3 text-primary" aria-hidden /> assessor rating
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3 text-amber-600" aria-hidden /> low confidence
          </span>
        </span>
      </div>
    </div>
  );
}
