import { useId } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { probeText } from "@/components/ui/confidence-badge";
import type { NotAssessedReason, SkillComparison } from "@/types";

const REASONS: Record<NotAssessedReason, string> = {
  not_covered: "It was not covered in the interview.",
  no_evidence: "No candidate quote supported a rating.",
  no_level_from_model: "The AI did not return a rating.",
  invalid_level_from_model: "The AI returned an unusable rating.",
};

const DIRECTION = { below: "tentatively below", equal: "tentatively at", above: "tentatively above" } as const;

function question(comparison: SkillComparison): { finding: string; ask: string } {
  const required = `L${comparison.expected_level}`;
  if (comparison.result === "low_confidence") {
    const direction = DIRECTION[comparison.tentative_direction ?? "equal"];
    return {
      finding: `${direction} ${required} from ${probeText(comparison.probe_count)}.`,
      ask: "Ask a deeper follow-up question to confirm it before it counts.",
    };
  }
  return {
    finding: `no evidence yet (required ${required}). ${REASONS[comparison.not_assessed_reason ?? "not_covered"]}`,
    ask: `Ask for a concrete example that shows this skill at ${required}.`,
  };
}

// Skills that do not count toward fit, written as what to ask next.
export default function FollowUpList({ comparisons }: { comparisons: SkillComparison[] }) {
  const headingId = useId();
  const items = comparisons.filter((comparison) => !comparison.counts_toward_fit);

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-lg border bg-card p-4">
      <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold">
        <MessageCircleQuestion aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
        Follow up in the next interview
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Every required skill has enough evidence. Nothing to follow up.</p>
      ) : (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {items.map((comparison, index) => {
            const { finding, ask } = question(comparison);
            return (
              <li key={`${comparison.skill_label}-${index}`} className="[overflow-wrap:anywhere]">
                <strong className="font-semibold">{comparison.skill_label}</strong>: {finding}{" "}
                <span className="text-muted-foreground">{ask}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
