import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison, SkillComparisonResult } from "@/types";
import { Check, ChevronsUp, TriangleAlert, CircleDashed, PencilLine } from "lucide-react";

/**
 * Fit/gap comparison.
 *
 * Two things this deliberately refuses to do, because the previous version
 * did both:
 *
 *  1. Report a count that does not add up to the number of required skills.
 *     "1 match, 2 gaps, 1 exceeds" against a six-skill role reads as a
 *     complete evaluation. The two skills nobody asked about were simply
 *     absent from the summary.
 *  2. Present an assessor's level as though the model produced it. A human
 *     overruling the model is the most load-bearing signal in the report and
 *     it was being rendered identically to an unreviewed AI guess.
 */

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

const RESULT_META: Record<
  SkillComparisonResult,
  { label: string; icon: typeof Check; badge: string; row?: string }
> = {
  match: {
    label: "Match",
    icon: Check,
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  exceed: {
    label: "Exceeds",
    icon: ChevronsUp,
    badge: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20",
  },
  gap: {
    label: "Gap",
    icon: TriangleAlert,
    badge: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  },
  // Neutral, never red: an unassessed skill is missing information, not a
  // finding against the candidate.
  not_assessed: {
    label: "Not assessed",
    icon: CircleDashed,
    badge: "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-500/20",
    row: "bg-neutral-50/60",
  },
};

const NOT_ASSESSED_COPY: Record<string, string> = {
  not_covered: "The interview never reached this skill.",
  insufficient_evidence: "Discussed, but the evidence did not support a level.",
};

function levelLabel(level?: number | null): string | null {
  if (level == null) return null;
  return LEVEL_LABELS[level] ?? `L${level}`;
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const meta = RESULT_META[comparison.result] ?? RESULT_META.not_assessed;
  const Icon = meta.icon;

  let suffix = "";
  if (comparison.delta != null && comparison.delta !== 0) {
    suffix = comparison.delta > 0 ? ` +${comparison.delta}` : ` ${comparison.delta}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.badge
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {meta.label}
      {suffix}
    </span>
  );
}

/** Candidate level, plus the provenance of that number. */
function CandidateLevel({ comparison }: { comparison: SkillComparison }) {
  const label = levelLabel(comparison.candidate_level);

  if (label == null) {
    const reason =
      NOT_ASSESSED_COPY[comparison.not_assessed_reason ?? ""] ??
      "No level was recorded for this skill.";
    return (
      <span className="text-neutral-400" title={reason} aria-label={reason}>
        —
      </span>
    );
  }

  const aiLabel = levelLabel(comparison.ai_level);
  const overridden = comparison.is_override === true;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-medium tabular-nums">{label}</span>
      {overridden && (
        <span
          className="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px]
                     font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20"
          title={
            aiLabel
              ? `Assessor override. The model assessed ${aiLabel}; an assessor recorded ${label}.`
              : `Assessor override. This level was set by a person, not the model.`
          }
        >
          <PencilLine className="h-2.5 w-2.5" aria-hidden />
          {aiLabel ? `was ${aiLabel}` : "assessor"}
        </span>
      )}
    </span>
  );
}

/** Proportional bar so the reader can see coverage without counting rows. */
function CoverageBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  if (total === 0) return null;

  const segments: Array<{ key: SkillComparisonResult; className: string }> = [
    { key: "match", className: "bg-emerald-500" },
    { key: "exceed", className: "bg-teal-500" },
    { key: "gap", className: "bg-amber-500" },
    { key: "not_assessed", className: "bg-neutral-300" },
  ];

  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"
      role="img"
      aria-label={`${counts.match} match, ${counts.exceed} exceeds, ${counts.gap} gap, ${counts.not_assessed} not assessed, of ${total} required skills`}
    >
      {segments.map(({ key, className }) =>
        counts[key] > 0 ? (
          <div
            key={key}
            className={className}
            style={{ width: `${(counts[key] / total) * 100}%` }}
          />
        ) : null
      )}
    </div>
  );
}

export default function ComparisonTable({ comparisons }: ComparisonTableProps) {
  const total = comparisons.length;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-10 text-center">
        <CircleDashed className="mx-auto h-6 w-6 text-neutral-300" aria-hidden />
        <p className="mt-2 text-sm font-medium">No skills to compare</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This vacancy has no required skills recorded, so there is nothing to compare the
          portfolio against. Add skills to the vacancy and regenerate.
        </p>
      </div>
    );
  }

  const counts = {
    match: 0,
    exceed: 0,
    gap: 0,
    not_assessed: 0,
  } as Record<string, number>;
  comparisons.forEach((c) => {
    counts[c.result] = (counts[c.result] ?? 0) + 1;
  });

  const notAssessed = counts.not_assessed;

  return (
    <div className="space-y-3">
      {/* Unassessed skills are stated before the table, not discovered by
          scanning it — this is the sentence that stops a partial evaluation
          being read as a complete one. */}
      {notAssessed > 0 && (
        <div
          className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5"
          role="status"
        >
          <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          <p className="text-xs leading-relaxed text-neutral-600">
            <span className="font-medium text-neutral-900">
              {notAssessed} of {total} required {total === 1 ? "skill" : "skills"} {notAssessed === 1 ? "was" : "were"} not
              assessed.
            </span>{" "}
            This is an incomplete picture of the candidate — absence of evidence is not evidence
            of a gap.
          </p>
        </div>
      )}

      {/* ── Desktop: table ───────────────────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-lg border sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Candidate skill levels compared against the levels this role requires
          </caption>
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">
                Skill
              </th>
              <th scope="col" className="w-24 px-3 py-2.5 text-center font-medium">
                Required
              </th>
              <th scope="col" className="w-36 px-3 py-2.5 text-center font-medium">
                Candidate
              </th>
              <th scope="col" className="w-36 px-3 py-2.5 text-center font-medium">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c, i) => {
              const meta = RESULT_META[c.result] ?? RESULT_META.not_assessed;
              const required = levelLabel(c.expected_level);
              return (
                <tr
                  key={`${c.skill_id ?? c.skill_label}-${i}`}
                  className={cn("border-b last:border-0", meta.row)}
                >
                  {/* Skill labels come from a free-text field with a 255 char
                      ceiling, so they must be allowed to wrap without pushing
                      the level columns off screen. */}
                  <td className="max-w-0 px-4 py-2.5 align-middle">
                    <span className="block truncate" title={c.skill_label}>
                      {c.skill_label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    {required ? (
                      <span
                        className="tabular-nums text-muted-foreground"
                        title={LEVEL_DESCRIPTIONS[c.expected_level]}
                      >
                        {required}
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <CandidateLevel comparison={c} />
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <ResultBadge comparison={c} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: stacked cards ────────────────────────────────────── */}
      <ul className="space-y-2 sm:hidden">
        {comparisons.map((c, i) => {
          const meta = RESULT_META[c.result] ?? RESULT_META.not_assessed;
          return (
            <li
              key={`${c.skill_id ?? c.skill_label}-${i}`}
              className={cn("rounded-lg border p-3", meta.row)}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">{c.skill_label}</p>
                <ResultBadge comparison={c} />
              </div>
              <dl className="mt-2 flex items-center gap-5 text-xs">
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">Required</dt>
                  <dd className="font-medium tabular-nums">
                    {levelLabel(c.expected_level) ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">Candidate</dt>
                  <dd>
                    <CandidateLevel comparison={c} />
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>

      {/* ── Summary: always accounts for every required skill ────────── */}
      <div className="space-y-2">
        <CoverageBar counts={counts} total={total} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Match {counts.match}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden />
            Exceeds {counts.exceed}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
            Gap {counts.gap}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neutral-300" aria-hidden />
            Not assessed {counts.not_assessed}
          </span>
          <span className="ml-auto tabular-nums">
            {total} required {total === 1 ? "skill" : "skills"}
          </span>
        </div>
      </div>
    </div>
  );
}
