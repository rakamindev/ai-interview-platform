import { Info } from "lucide-react";
import { END_REASON_COPY, pluralize, summarizeSkills } from "@/utils/skills";
import type { EndReason, PortfolioSkill } from "@/types";

interface AssessmentSummaryProps {
  skills: PortfolioSkill[];
  endReason?: EndReason | null;
}

export default function AssessmentSummary({ skills, endReason }: AssessmentSummaryProps) {
  const { rated, total, unrated } = summarizeSkills(skills);
  const endedEarlyCopy = endReason ? END_REASON_COPY[endReason] : undefined;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm">
          <span className="font-semibold">
            {rated} of {total}
          </span>{" "}
          configured skills rated
        </p>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i < rated ? "flex-1 bg-primary" : "flex-1 bg-neutral-200"} />
          ))}
        </div>
      </div>

      {unrated > 0 && (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            {endedEarlyCopy ? `${endedEarlyCopy}. ` : ""}
            {pluralize(unrated, "skill")} {unrated === 1 ? "has" : "have"} no rating. Missing evidence is not weak
            evidence, so they are left blank instead of scored.
          </p>
        </div>
      )}
    </div>
  );
}
