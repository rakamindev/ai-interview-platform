import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SkillComparison } from "@/types";

const labels = {
  match: "Meets requirement",
  exceed: "Above requirement",
  gap: "Below requirement",
  not_assessed: "Not assessed",
};
const colors = {
  match: "bg-teal-50 text-teal-900",
  exceed: "bg-teal-50 text-teal-900",
  gap: "bg-amber-50 text-amber-900",
  not_assessed: "bg-slate-100 text-slate-800",
};
const reasons = {
  missing_skill:
    "This skill was not assessed. Arrange a follow-up if it matters for the role.",
  missing_rating:
    "A valid rating is unavailable. Review the source assessment.",
  ambiguous_skill:
    "Multiple skills match this requirement. Resolve the skill mapping before comparing.",
  invalid_requirement:
    "The vacancy needs a valid L1-L5 requirement before comparison.",
};

export default function ComparisonTable({
  comparisons,
}: {
  comparisons: SkillComparison[];
}) {
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const needsFollowUp = (row: SkillComparison) =>
    row.result === "gap" ||
    row.result === "not_assessed" ||
    (row.rating_source === "ai" && row.confidence === "low");
  const count = comparisons.filter(needsFollowUp).length;
  const visible = followUpOnly
    ? comparisons.filter(needsFollowUp)
    : comparisons;

  if (!comparisons.length)
    return (
      <div className="rounded-lg border p-6 space-y-2">
        <h2 className="font-semibold">No skill requirements configured</h2>
        <p className="text-sm text-slate-600">
          Add skill requirements to the vacancy, then refresh this comparison.
          An empty report does not indicate a match.
        </p>
      </div>
    );

  return (
    <section
      aria-labelledby="comparison-title"
      className="space-y-4 [&_button]:min-h-11 [&_button]:focus-visible:ring-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="comparison-title" className="text-lg font-semibold">
          Skill comparison
        </h2>
        <div
          className="flex flex-wrap gap-2"
          aria-label="Filter skill comparison"
        >
          <Button
            variant={followUpOnly ? "outline" : "default"}
            aria-pressed={!followUpOnly}
            onClick={() => setFollowUpOnly(false)}
          >
            All ({comparisons.length})
          </Button>
          <Button
            variant={followUpOnly ? "default" : "outline"}
            aria-pressed={followUpOnly}
            onClick={() => setFollowUpOnly(true)}
          >
            Needs follow-up ({count})
          </Button>
        </div>
      </div>
      {visible.length === 0 ? (
        <p role="status" className="rounded-lg border p-6 text-sm">
          No skills need follow-up in this comparison. Review the interview
          evidence before deciding.
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">
              Vacancy requirements compared with assessed skill levels. Missing
              assessment is not a skill gap.
            </caption>
            <thead className="hidden sm:table-header-group bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="w-[34%] p-4 text-left font-medium">
                  Skill
                </th>
                <th scope="col" className="w-[18%] p-4 text-left font-medium">
                  Required
                </th>
                <th scope="col" className="w-[20%] p-4 text-left font-medium">
                  Assessed
                </th>
                <th scope="col" className="p-4 text-left font-medium">
                  Comparison
                </th>
              </tr>
            </thead>
            <tbody className="block sm:table-row-group">
              {visible.map((row) => (
                <tr
                  key={row.vacancy_skill_id}
                  className="block border-t first:border-t-0 sm:table-row sm:first:border-t"
                >
                  <th
                    scope="row"
                    className="block p-4 pb-2 text-left align-top font-normal sm:table-cell sm:pb-4"
                  >
                    <span className="block font-semibold break-words [overflow-wrap:anywhere]">
                      {row.skill_label}
                    </span>
                    {row.confidence && (
                      <span className="block mt-1 text-xs text-slate-600">
                        AI confidence: {row.confidence}
                      </span>
                    )}
                  </th>
                  <td className="inline-block w-1/2 px-4 py-2 align-top sm:table-cell sm:w-auto sm:py-4">
                    <span className="block text-xs text-slate-600 sm:hidden">
                      Required
                    </span>
                    {row.expected_level == null
                      ? "Not configured"
                      : "L" + row.expected_level}
                  </td>
                  <td className="inline-block w-1/2 px-4 py-2 align-top sm:table-cell sm:w-auto sm:py-4">
                    <span className="block text-xs text-slate-600 sm:hidden">
                      Assessed
                    </span>
                    {row.candidate_level == null
                      ? "Not assessed"
                      : "L" + row.candidate_level}
                    <span className="block mt-1 text-xs text-slate-600">
                      {row.rating_source === "assessor"
                        ? "Assessor override"
                        : row.rating_source === "ai"
                          ? "AI rating"
                          : "No usable rating"}
                    </span>
                  </td>
                  <td className="block px-4 pb-4 pt-2 align-top sm:table-cell sm:pt-4">
                    <span
                      className={
                        "inline-block rounded px-2 py-1 text-xs font-medium " +
                        colors[row.result]
                      }
                    >
                      {labels[row.result]}
                    </span>
                    {row.delta != null && (
                      <span className="block mt-1 text-xs text-slate-600">
                        Difference: {row.delta > 0 ? "+" : ""}
                        {row.delta} level{Math.abs(row.delta) !== 1 ? "s" : ""}
                      </span>
                    )}
                    {row.reason && (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        {reasons[row.reason]}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs leading-relaxed text-slate-600">
        Follow-up includes skill gaps, missing assessments, and low-confidence
        AI ratings still used in this comparison. Confidence describes the AI
        assessment; an override identifies the human rating used.
      </p>
    </section>
  );
}
