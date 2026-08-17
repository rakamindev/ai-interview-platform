import {
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  CircleHelp,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LEVEL_LABELS } from "@/utils/constants";

import { requiredLevel } from "../lib/fit-gap";
import type { SkillComparison } from "../types/fit-gap.types";

interface FitGapComparisonTableProps {
  comparisons: SkillComparison[];
}

const resultPresentation = {
  match: {
    label: "Meets requirement",
    icon: CheckCircle2,
    classes: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  exceed: {
    label: "Above requirement",
    icon: ArrowUpRight,
    classes: "border-teal-200 bg-teal-50 text-teal-800",
  },
  gap: {
    label: "Below requirement",
    icon: TriangleAlert,
    classes: "border-amber-200 bg-amber-50 text-amber-900",
  },
  not_assessed: {
    label: "Not assessed",
    icon: CircleHelp,
    classes: "border-slate-200 bg-slate-50 text-slate-700",
  },
} as const;

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const presentation = resultPresentation[comparison.result];
  const Icon = presentation.icon;
  const delta = comparison.delta
    ? ` (${comparison.delta > 0 ? "+" : ""}${comparison.delta})`
    : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        presentation.classes,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {presentation.label}
      {delta}
    </span>
  );
}

function Confidence({ comparison }: { comparison: SkillComparison }) {
  if (comparison.result === "not_assessed") {
    return <span className="text-xs text-slate-500">No interview signal</span>;
  }

  const confidence = comparison.confidence ?? "unknown";
  const evidence = comparison.evidence_count ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      <span className="capitalize">{confidence} confidence</span>
      <span aria-hidden="true">·</span>
      <span>
        {evidence} evidence quote{evidence === 1 ? "" : "s"}
      </span>
      {comparison.is_override ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
          <BadgeCheck className="h-3 w-3" aria-hidden="true" />
          Human reviewed
        </span>
      ) : null}
    </div>
  );
}

function LevelCell({ level }: { level?: number }) {
  if (level == null) return <span className="text-slate-400">Not available</span>;

  return (
    <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-md bg-slate-100 px-2 font-semibold text-slate-800">
      {LEVEL_LABELS[level] ?? `L${level}`}
    </span>
  );
}

export function FitGapComparisonTable({ comparisons }: FitGapComparisonTableProps) {
  if (comparisons.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
        No role requirements are available for comparison.
      </div>
    );
  }

  return (
    <div>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 lg:block">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Candidate evidence compared with role requirements
          </caption>
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-5 py-3 font-semibold">
                Skill and evidence
              </th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                Required
              </th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                Observed
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Outcome
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparisons.map((comparison) => (
              <tr
                key={`${comparison.skill_label}-${comparison.result}`}
                className="align-middle hover:bg-slate-50/60"
              >
                <th scope="row" className="px-5 py-4 text-left font-medium">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-slate-900">{comparison.skill_label}</p>
                    <Confidence comparison={comparison} />
                  </div>
                </th>
                <td className="px-4 py-4 text-center">
                  <LevelCell level={requiredLevel(comparison)} />
                </td>
                <td className="px-4 py-4 text-center">
                  <LevelCell level={comparison.candidate_level} />
                </td>
                <td className="px-5 py-4">
                  <ResultBadge comparison={comparison} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {comparisons.map((comparison) => (
          <article
            key={`${comparison.skill_label}-${comparison.result}`}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{comparison.skill_label}</h3>
                <div className="mt-1.5">
                  <Confidence comparison={comparison} />
                </div>
              </div>
              <ResultBadge comparison={comparison} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Required
                </dt>
                <dd className="mt-1">
                  <LevelCell level={requiredLevel(comparison)} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Observed
                </dt>
                <dd className="mt-1">
                  <LevelCell level={comparison.candidate_level} />
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
