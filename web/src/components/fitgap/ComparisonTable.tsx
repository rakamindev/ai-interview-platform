import { useState } from "react";
import {
  LEVEL_LABELS,
  FIT_GAP_RESULT_LABELS,
  FIT_GAP_RESULT_CLASSES,
  ASSESSMENT_STATE_EXPLANATIONS,
  CONFIDENCE_CLASSES,
} from "@/utils/constants";
import { cn } from "@/lib/utils";
import { ChevronDown, Info } from "lucide-react";
import type { SkillComparison } from "@/types";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function levelText(level: number | null): string {
  return level == null ? "—" : LEVEL_LABELS[level];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const { result, delta } = comparison;
  const suffix =
    (result === "exceed" || result === "gap") && delta != null && delta !== 0
      ? ` ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`
      : "";

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        FIT_GAP_RESULT_CLASSES[result],
      )}
    >
      {FIT_GAP_RESULT_LABELS[result]}
      {suffix}
    </span>
  );
}

function ConfidenceChip({ comparison }: { comparison: SkillComparison }) {
  // Confidence was computed by the engine, stored, and never shown. A gap
  // derived from a low-confidence rating was indistinguishable from one backed
  // by three probes, so an assessor could not tell how much weight to give it.
  if (comparison.result === "not_assessed") return null;
  if (!comparison.confidence) return null;

  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium capitalize",
        CONFIDENCE_CLASSES[comparison.confidence],
      )}
      title={`AI confidence in this rating: ${comparison.confidence}`}
    >
      {comparison.confidence}
    </span>
  );
}

/** Shows which rating drove the verdict, and where it came from. */
function CandidateLevel({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result === "not_assessed") {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <span aria-hidden>—</span>
        {/* Distinct from the Result column's "Not assessed" badge: repeating it
            makes a screen reader announce the same verdict twice per row. */}
        <span className="sr-only">No rating recorded</span>
      </span>
    );
  }

  if (comparison.is_override) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <span className="text-xs text-muted-foreground line-through">
          {levelText(comparison.ai_level)}
        </span>
        <span aria-hidden className="text-muted-foreground">
          →
        </span>
        <span className="font-medium">{levelText(comparison.candidate_level)}</span>
        <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
          your rating
        </span>
      </span>
    );
  }

  return <span className="font-medium">{levelText(comparison.candidate_level)}</span>;
}

function NotAssessedNote({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result !== "not_assessed") return null;

  return (
    <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span>{ASSESSMENT_STATE_EXPLANATIONS[comparison.assessment_state]}</span>
    </p>
  );
}

function Row({ comparison }: { comparison: SkillComparison }) {
  const [open, setOpen] = useState(false);
  const expandable = comparison.result === "not_assessed";

  return (
    <tr className="border-b last:border-0 align-top">
        <td className="max-w-[18rem] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium" title={comparison.skill_label}>
              {comparison.skill_label}
            </span>
            {comparison.in_vacancy === false && (
              <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700">
                not required
              </span>
            )}
          </div>
          {expandable && open && <NotAssessedNote comparison={comparison} />}
        </td>
        <td className="px-4 py-2.5 text-center text-muted-foreground">
          {levelText(comparison.required_level)}
        </td>
        <td className="px-4 py-2.5 text-center">
          <CandidateLevel comparison={comparison} />
        </td>
        <td className="px-4 py-2.5 text-center">
          <ConfidenceChip comparison={comparison} />
        </td>
        <td className="px-4 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <ResultBadge comparison={comparison} />
            {expandable && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={`Why was ${comparison.skill_label} not assessed?`}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
              </button>
            )}
          </div>
      </td>
    </tr>
  );
}

function Card({ comparison }: { comparison: SkillComparison }) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{comparison.skill_label}</span>
        <ResultBadge comparison={comparison} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Required</dt>
        <dd className="text-right">{levelText(comparison.required_level)}</dd>
        <dt className="text-muted-foreground">Candidate</dt>
        <dd className="text-right">
          <CandidateLevel comparison={comparison} />
        </dd>
      </dl>
      <ConfidenceChip comparison={comparison} />
      <NotAssessedNote comparison={comparison} />
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  if (comparisons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm font-medium">No skills to compare</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This vacancy lists no required skills, so there is nothing to compare this
          portfolio against yet.
        </p>
      </div>
    );
  }

  const counts = comparisons.reduce<Record<string, number>>((acc, c) => {
    acc[c.result] = (acc[c.result] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* Table for md and up */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Candidate skill levels compared against the levels this role requires
          </caption>
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Skill</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Required</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Candidate</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Confidence</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => (
              <Row key={`${c.skill_label}-${i}`} comparison={c} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards below md — a five-column table is unreadable on a phone */}
      <div className="space-y-2 md:hidden">
        {comparisons.map((c, i) => (
          <Card key={`${c.skill_label}-${i}`} comparison={c} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(["match", "exceed", "gap", "not_assessed", "additional"] as const)
          .filter((result) => counts[result])
          .map((result) => (
            <span key={result}>
              {FIT_GAP_RESULT_LABELS[result]}: {counts[result]}
            </span>
          ))}
      </div>
    </div>
  );
}
