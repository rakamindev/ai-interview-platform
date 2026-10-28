import type { ReactNode } from "react";
import { ClampText } from "@/components/ui/clamp-text";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { LevelScale } from "@/components/ui/level-scale";
import { LevelSourceMarker } from "@/components/ui/level-source-marker";
import { ResultBadge } from "@/components/ui/result-badge";
import SkillEvidence from "@/components/fitgap/SkillEvidence";
import type { PortfolioSkill, SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
  skillsById?: Map<number, PortfolioSkill>;
}

// Gaps first, then what still needs evidence, then what already fits.
const RESULT_ORDER: Record<SkillComparison["result"], number> = {
  gap: 0,
  low_confidence: 1,
  not_assessed: 2,
  match: 3,
  exceed: 4,
};

// One column template for the header and every row (desktop); below md each
// row becomes a stacked card with its own field labels.
const COLUMNS =
  "md:grid-cols-[minmax(0,1.5fr)_4.5rem_minmax(0,1.7fr)_minmax(0,1.2fr)_minmax(0,1.3fr)]";

export function sortComparisons(comparisons: SkillComparison[]): SkillComparison[] {
  return comparisons
    .map((comparison, index) => ({ comparison, index }))
    .sort((a, b) => RESULT_ORDER[a.comparison.result] - RESULT_ORDER[b.comparison.result] || a.index - b.index)
    .map(({ comparison }) => comparison);
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="cell" className="min-w-0 space-y-1">
      <span className="block text-xs font-medium text-slate-700 md:hidden">{label}</span>
      {children}
    </div>
  );
}

function Confidence({ comparison }: { comparison: SkillComparison }) {
  if (comparison.confidence) {
    return <ConfidenceBadge confidence={comparison.confidence} probeCount={comparison.probe_count} />;
  }
  const text = comparison.level_source === "assessor_override" ? "Not applicable: assessor rating" : "No evidence";
  return <span className="text-xs text-muted-foreground">{text}</span>;
}

function ComparisonRow({ comparison, skill }: { comparison: SkillComparison; skill: PortfolioSkill | undefined }) {
  return (
    <div role="row" className={`grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 md:items-start ${COLUMNS}`}>
      <div role="rowheader" className="col-span-2 min-w-0 text-sm font-medium md:col-span-1">
        <ClampText text={comparison.skill_label} lines={2} maxChars={80} expandLabel="Show full name" />
      </div>
      <Cell label="Required">
        <span className="text-sm font-medium tabular-nums">{`L${comparison.expected_level}`}</span>
      </Cell>
      <Cell label="Candidate">
        <div className="flex flex-wrap items-center gap-2">
          <LevelScale required={comparison.expected_level} candidate={comparison.candidate_level} />
          <span className="text-sm font-medium tabular-nums">
            {comparison.candidate_level ? `L${comparison.candidate_level}` : "Not assessed"}
          </span>
        </div>
        <LevelSourceMarker source={comparison.level_source} aiLevel={comparison.ai_level ?? null} review={comparison.review} />
      </Cell>
      <Cell label="Result">
        <ResultBadge result={comparison.result} delta={comparison.delta} tentativeDirection={comparison.tentative_direction} />
      </Cell>
      <Cell label="Confidence">
        <Confidence comparison={comparison} />
      </Cell>
      <div role="cell" className="col-span-2 min-w-0 md:col-span-5">
        <SkillEvidence comparison={comparison} skill={skill} />
      </div>
    </div>
  );
}

export default function ComparisonTable({ comparisons, skillsById }: ComparisonTableProps) {
  const rows = sortComparisons(comparisons);

  return (
    <div role="table" aria-label="Skill comparison" className="overflow-hidden rounded-lg border bg-card">
      <div role="rowgroup" className="hidden border-b bg-muted/50 md:block">
        <div role="row" className={`grid gap-x-4 px-4 py-2.5 text-xs font-medium text-slate-700 ${COLUMNS}`}>
          <span role="columnheader">Skill</span>
          <span role="columnheader">Required</span>
          <span role="columnheader">Candidate</span>
          <span role="columnheader">Result</span>
          <span role="columnheader">Confidence</span>
          <span role="columnheader" className="sr-only">Evidence and review</span>
        </div>
      </div>
      <div role="rowgroup" className="divide-y">
        {rows.map((comparison, index) => (
          <ComparisonRow
            key={`${comparison.skill_label}-${index}`}
            comparison={comparison}
            skill={comparison.portfolio_skill_id != null ? skillsById?.get(comparison.portfolio_skill_id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
