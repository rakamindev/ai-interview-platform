import { UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIT_GAP_RESULT_CLASSES, FIT_GAP_RESULT_LABELS, levelLabel } from "@/utils/constants";
import LevelTrack from "@/components/portfolio/LevelTrack";
import type { SkillComparison, SkillComparisonResult } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultText({ comparison }: { comparison: SkillComparison }) {
  const { result, delta } = comparison;
  const steps = delta ? ` by ${Math.abs(delta)} level${Math.abs(delta) === 1 ? "" : "s"}` : "";
  return (
    <span className={cn("text-sm font-medium", FIT_GAP_RESULT_CLASSES[result])}>
      {FIT_GAP_RESULT_LABELS[result]}
      {(result === "gap" || result === "exceed") && <span className="font-normal">{steps}</span>}
    </span>
  );
}

function CandidateLevel({ comparison }: { comparison: SkillComparison }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 tabular-nums">
      {comparison.candidate_level == null ? (
        <span className="text-muted-foreground">No evidence</span>
      ) : (
        levelLabel(comparison.candidate_level)
      )}
      {comparison.is_override && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
          <UserCheck aria-hidden className="h-3 w-3 text-evidence" />
          Assessor
        </span>
      )}
    </span>
  );
}

const SUMMARY_ORDER: SkillComparisonResult[] = ["match", "exceed", "gap", "not_assessed"];

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const counts = SUMMARY_ORDER.map((result) => ({
    result,
    count: comparisons.filter((c) => c.result === result).length,
  })).filter(({ count }) => count > 0);

  return (
    <div className="space-y-3">
      {/* Wide screens: a table. */}
      <table className="hidden w-full text-sm sm:table">
        <caption className="sr-only">Candidate level compared with the level this vacancy requires</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">Skill</th>
            <th scope="col" className="px-3 py-2 font-medium">Required</th>
            <th scope="col" className="px-3 py-2 font-medium">Candidate</th>
            <th scope="col" className="px-3 py-2 font-medium">
              <span className="sr-only">Level scale</span>
            </th>
            <th scope="col" className="py-2 pl-3 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map((c) => (
            <tr key={c.skill_label} className="border-b align-middle last:border-0">
              <th scope="row" className="max-w-[16rem] break-words py-3 pr-3 text-left font-medium">
                {c.skill_label}
              </th>
              <td className="px-3 py-3 tabular-nums text-muted-foreground">{levelLabel(c.expected_level)}</td>
              <td className="px-3 py-3">
                <CandidateLevel comparison={c} />
              </td>
              <td className="px-3 py-3">
                <LevelTrack level={c.candidate_level} required={c.expected_level} highlightShortfall />
              </td>
              <td className="py-3 pl-3">
                <ResultText comparison={c} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Narrow screens: one block per skill. */}
      <ul className="divide-y sm:hidden" aria-label="Skill comparison">
        {comparisons.map((c) => (
          <li key={c.skill_label} className="space-y-2 py-3">
            <div className="flex items-start justify-between gap-3">
              <span className="break-words font-medium">{c.skill_label}</span>
              <span className="shrink-0 whitespace-nowrap">
                <ResultText comparison={c} />
              </span>
            </div>
            <LevelTrack level={c.candidate_level} required={c.expected_level} highlightShortfall />
            <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>Required {levelLabel(c.expected_level)}</span>
              <span>
                Candidate <CandidateLevel comparison={c} />
              </span>
            </p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
        {counts.map(({ result, count }) => (
          <span key={result}>
            <span className={cn("font-semibold tabular-nums", FIT_GAP_RESULT_CLASSES[result])}>{count}</span>{" "}
            {FIT_GAP_RESULT_LABELS[result].toLowerCase()}
          </span>
        ))}
        <span className="inline-flex items-center gap-2 sm:ml-auto">
          <span aria-hidden className="flex items-end gap-1">
            <span className="h-2.5 w-3 rounded-[2px] bg-evidence" />
            <span className="h-[3px] w-3 rounded-full bg-required" />
          </span>
          Filled: candidate. Underline: required.
        </span>
      </div>
    </div>
  );
}
