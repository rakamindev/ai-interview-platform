import type { ReactNode } from "react";
import { LEVEL_LABELS, FIT_GAP_RESULT_LABELS, FIT_GAP_RESULT_CLASSES } from "@/utils/constants";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Check, CircleDashed, Pencil } from "lucide-react";
import type { SkillComparison } from "@/types";
import EmptyState from "@/components/feedback/EmptyState";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

/** Reports generated before the payload fix only carry `expected_level`. */
export function requiredLevelOf(c: SkillComparison): number | undefined {
  return c.required_level ?? c.expected_level;
}

function levelLabel(level: number): string {
  return LEVEL_LABELS[level] ?? `L${level}`;
}

function OverrideMark() {
  return (
    <span
      role="img"
      className="inline-flex items-center text-amber-700 bg-amber-50 rounded p-0.5"
      title="Human assessor override applied"
      aria-label="Human assessor override applied"
    >
      <Pencil className="h-3 w-3" aria-hidden />
    </span>
  );
}

const RESULT_ICONS = { match: Check, exceed: ArrowUp, gap: ArrowDown, not_assessed: CircleDashed } as const;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result] ?? comparison.result;
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  const Icon = RESULT_ICONS[comparison.result] ?? CircleDashed;
  let suffix = "";
  if (comparison.result === "exceed" && comparison.delta) suffix = ` +${comparison.delta}`;
  else if (comparison.result === "gap" && comparison.delta) suffix = ` -${Math.abs(comparison.delta)}`;

  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded", classes)}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}{suffix}
    </span>
  );
}

function SummaryChip({ result, children }: { result: SkillComparison["result"]; children: ReactNode }) {
  const Icon = RESULT_ICONS[result];
  return (
    <li className={cn("inline-flex items-center gap-1 rounded px-2 py-1 font-medium", FIT_GAP_RESULT_CLASSES[result])}>
      <Icon className="h-3 w-3" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (comparisons.length === 0) {
    return (
      <EmptyState
        title="No required skills on this vacancy"
        description="Add skills with an expected level to the vacancy, then regenerate this report."
      />
    );
  }

  // Summary counts
  const count = (result: SkillComparison["result"]) => comparisons.filter((c) => c.result === result).length;
  const matchCount = count("match");
  const gapCount = count("gap");
  const exceedCount = count("exceed");
  const notAssessedCount = count("not_assessed");
  const hasOverride = comparisons.some((c) => c.is_override || c.overridden);

  return (
    <div className="space-y-3">
      {/* Verdict first: the counts are what a hiring manager reads before the rows */}
      <ul aria-label="Comparison summary" className="flex flex-wrap items-center gap-2 text-xs">
        {matchCount > 0 && <SummaryChip result="match">Match: {plural(matchCount, "skill")}</SummaryChip>}
        {exceedCount > 0 && <SummaryChip result="exceed">Exceeds: {plural(exceedCount, "skill")}</SummaryChip>}
        {gapCount > 0 && <SummaryChip result="gap">Gap: {plural(gapCount, "skill")}</SummaryChip>}
        {notAssessedCount > 0 && <SummaryChip result="not_assessed">Not assessed: {plural(notAssessedCount, "skill")}</SummaryChip>}
        {hasOverride && (
          <li className="inline-flex items-center gap-1.5 text-muted-foreground sm:ml-auto">
            <OverrideMark /> Assessor override
          </li>
        )}
      </ul>

      {/* Phones: one card per skill so long labels and badges never squeeze a 4-column table */}
      <ul aria-label="Skill comparison" className="sm:hidden divide-y rounded-lg border">
        {comparisons.map((c, i) => {
          const reqLevel = requiredLevelOf(c);
          return (
            <li key={`${c.skill_label}-${i}`} className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium break-words min-w-0">{c.skill_label}</span>
                <ResultBadge comparison={c} />
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Required {reqLevel != null ? levelLabel(reqLevel) : "not set"} · Candidate{" "}
                {c.candidate_level != null ? (
                  <span className="font-medium text-foreground">{levelLabel(c.candidate_level)}</span>
                ) : (
                  "none"
                )}
                {(c.is_override || c.overridden) && <OverrideMark />}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden sm:block overflow-x-auto rounded-lg border">
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
            {comparisons.map((c, i) => {
              const reqLevel = requiredLevelOf(c);
              const isOverridden = Boolean(c.is_override || c.overridden);
              return (
                <tr key={`${c.skill_label}-${i}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium break-words max-w-[16rem]">{c.skill_label}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">
                    {reqLevel != null ? levelLabel(reqLevel) : "Not set"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {c.candidate_level != null ? (
                      <span className="inline-flex items-center gap-1 font-medium">
                        {levelLabel(c.candidate_level)}
                        {isOverridden && <OverrideMark />}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {notAssessedCount > 0 && (
        <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
          Not assessed means the interview never reached this skill. It is not counted as a gap. Probe it in a
          follow-up round before deciding.
        </p>
      )}
    </div>
  );
}
