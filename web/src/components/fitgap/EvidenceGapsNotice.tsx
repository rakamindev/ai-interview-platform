import { Link } from "react-router-dom";
import { CircleAlert } from "lucide-react";
import type { EvidenceGap } from "@/types";

interface EvidenceGapsNoticeProps {
  gaps: EvidenceGap[];
  portfolioPath: string;
  vacancyEditPath: string;
}

const END_REASONS: Record<string, string> = {
  manual_candidate: "the candidate ended it",
  error: "of a technical error",
};

function GapItem({ gap, portfolioPath, vacancyEditPath }: { gap: EvidenceGap } & Omit<EvidenceGapsNoticeProps, "gaps">) {
  const skills = gap.skills.join(", ");
  switch (gap.reason) {
    case "skills_not_assessed":
      return (
        <>
          <span className="font-medium">Not covered in the interview:</span> {skills}.{" "}
          <Link to={portfolioPath} className="font-medium underline underline-offset-2">
            Rate {gap.skills.length === 1 ? "it" : "them"} on the portfolio
          </Link>
        </>
      );
    case "low_confidence":
      return (
        <>
          <span className="font-medium">Low confidence, not yet confirmed:</span> {skills}.{" "}
          <Link to={portfolioPath} className="font-medium underline underline-offset-2">
            Confirm or adjust on the portfolio
          </Link>
        </>
      );
    case "interview_incomplete":
      return (
        <>
          <span className="font-medium">The interview ended early</span> because{" "}
          {END_REASONS[gap.end_reason ?? ""] ?? "it did not finish"}. Consider inviting the candidate again.
        </>
      );
    case "no_vacancy_skills":
      return (
        <>
          <span className="font-medium">This vacancy has no required skills,</span> so there is nothing to compare.{" "}
          <Link to={vacancyEditPath} className="font-medium underline underline-offset-2">
            Add skills to the vacancy
          </Link>
        </>
      );
  }
}

/** Shown in place of a recommendation when the evidence gate withheld one. */
export default function EvidenceGapsNotice({ gaps, portfolioPath, vacancyEditPath }: EvidenceGapsNoticeProps) {
  return (
    <section
      aria-labelledby="evidence-gaps-title"
      className="rounded-lg border border-attention-border bg-attention-surface p-4 text-attention sm:p-5"
    >
      <div className="flex gap-3">
        <CircleAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-2">
          <h2 id="evidence-gaps-title" className="font-semibold">
            No recommendation yet
          </h2>
          <p className="text-sm">
            The evidence isn't strong enough to recommend a decision. Ratings you add on the portfolio update this report
            automatically.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {gaps.map((gap) => (
              <li key={gap.reason}>
                <GapItem gap={gap} portfolioPath={portfolioPath} vacancyEditPath={vacancyEditPath} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
