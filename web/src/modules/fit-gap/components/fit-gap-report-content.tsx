import { AlertCircle, BadgeCheck, Bot, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Portfolio } from "@/types";

import type { FitGapReport, FitGapReviewSummary } from "../types/fit-gap.types";
import { FitGapComparisonTable } from "./fit-gap-comparison-table";

interface FitGapReportContentProps {
  portfolio: Portfolio;
  report: FitGapReport;
  reviewSummary: FitGapReviewSummary;
}

type SummaryTone = "slate" | "emerald" | "amber" | "teal";

const summaryTones: Record<SummaryTone, string> = {
  slate: "border-slate-200 bg-white text-slate-900",
  emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  amber: "border-amber-200 bg-amber-50/70 text-amber-950",
  teal: "border-teal-200 bg-teal-50/70 text-teal-900",
};

function SummaryMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: SummaryTone;
}) {
  return (
    <div className={`rounded-xl border p-4 ${summaryTones[tone]}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
    </div>
  );
}

function ReviewDecision({ summary }: { summary: FitGapReviewSummary }) {
  const requiresReview = summary.decision_status === "review_required";

  return (
    <section
      className={
        requiresReview
          ? "rounded-2xl border border-amber-200 bg-amber-50 p-5"
          : "rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
      }
    >
      <div className="flex items-start gap-3">
        {requiresReview ? (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        ) : (
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
        )}
        <div>
          <h2 className="font-semibold text-slate-950">
            {requiresReview
              ? "Human review required before this report informs a decision"
              : "Evidence is ready for structured human review"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {requiresReview
              ? `${summary.not_assessed} unassessed and ${summary.low_confidence} low-confidence requirement(s) need follow-up. Absence of evidence is not evidence of a skill gap.`
              : "Every required skill has usable evidence. Validate quotes and context before recording a hiring outcome."}
          </p>
        </div>
      </div>
    </section>
  );
}

export function FitGapReportContent({
  portfolio,
  report,
  reviewSummary,
}: FitGapReportContentProps) {
  const discoveredSkills = portfolio.skills.filter((skill) => skill.is_discovered);

  return (
    <>
      <ReviewDecision summary={reviewSummary} />

      <section aria-labelledby="summary-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              At a glance
            </p>
            <h2 id="summary-title" className="mt-1 text-lg font-semibold text-slate-950">
              Requirement coverage
            </h2>
          </div>
          <p className="text-xs text-slate-500">{reviewSummary.total_skills} required skills</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryMetric label="Meets" value={reviewSummary.match} tone="emerald" />
          <SummaryMetric label="Above" value={reviewSummary.exceed} tone="teal" />
          <SummaryMetric label="Below" value={reviewSummary.gap} tone="amber" />
          <SummaryMetric label="Not assessed" value={reviewSummary.not_assessed} />
        </div>
      </section>

      <section aria-labelledby="comparison-title">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Traceable evidence
          </p>
          <h2 id="comparison-title" className="mt-1 text-lg font-semibold text-slate-950">
            Skill-by-skill comparison
          </h2>
        </div>
        <FitGapComparisonTable comparisons={report.skill_comparisons} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Contextual synthesis
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Culture and competency context
            </h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
              {report.culture_narrative ||
                report.overall_narrative ||
                "No narrative was generated. Use the structured comparison above for review."}
            </p>
          </CardContent>
        </Card>

        <aside className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-2 text-blue-900">
            <Bot className="h-5 w-5" aria-hidden="true" />
            <h2 className="font-semibold">AI use boundary</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-blue-900/80">
            AI drafts the narrative and evidence ratings. It does not make, rank, or approve a
            hiring decision. Review the transcript, evidence quotes, confidence, and any assessor
            overrides before acting.
          </p>
        </aside>
      </div>

      {discoveredSkills.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="font-semibold text-slate-950">
            Additional signals, outside role requirements
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            These skills were mentioned during the interview but are not scored as role fit.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {discoveredSkills.map((skill) => (
              <span
                key={skill.id}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                {skill.skill_label} · {skill.ai_level} · {skill.ai_confidence} confidence
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
